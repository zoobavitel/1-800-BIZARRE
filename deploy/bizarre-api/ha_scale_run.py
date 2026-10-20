#!/usr/bin/env python3
"""One scaler tick for the bizarre-api gunicorn pool.

Root runs this from bizarre-scale.service. It does not migrate, and it does
not restart a healthy floor instance.
"""

import importlib.util
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO / "backend" / "src" / "app" / "ha_scale.py"
STATE_PATH = Path("/run/bizarre/scale-state.json")
CADDY_PATH = Path("/etc/bizarre/lb.caddy")
SYSTEMCTL = "/usr/bin/systemctl"
CADDY = "/usr/bin/caddy"
SS = "/usr/bin/ss"


def load_ha_scale():
    spec = importlib.util.spec_from_file_location("ha_scale", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def is_active(instance):
    result = subprocess.run(
        [SYSTEMCTL, "is-active", "--quiet", "gunicorn@%d" % instance]
    )
    return result.returncode == 0


def count_conns(port):
    result = subprocess.run(
        [SS, "-Htn", "state", "established", "sport", "=", ":%d" % port],
        capture_output=True,
        text=True,
        check=False,
    )
    return len([line for line in result.stdout.splitlines() if line.strip()])


def load_state():
    try:
        return json.loads(STATE_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return {"high_streak": 0, "low_streak": {}}


def save_state(state):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "high_streak": state["high_streak"],
        "low_streak": {str(k): v for k, v in state["low_streak"].items()},
    }
    tmp = STATE_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload) + "\n")
    tmp.replace(STATE_PATH)


def wait_health(ha_scale, instance):
    url = "http://127.0.0.1:%d/api/health/" % ha_scale.port_for(instance)
    for _ in range(20):
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return True
        except OSError:
            pass
        time.sleep(0.5)
    return False


def write_caddyfile(ha_scale, instances, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = ha_scale.render_caddyfile(instances)
    tmp = path.with_suffix(".caddy.tmp")
    tmp.write_text(text)
    tmp.replace(path)
    return text


def reload_caddy():
    if not Path(CADDY).exists():
        return False
    result = subprocess.run(
        [
            CADDY,
            "reload",
            "--config",
            str(CADDY_PATH),
            "--adapter",
            "caddyfile",
            "--address",
            "127.0.0.1:2021",
        ],
        check=False,
    )
    return result.returncode == 0


def sync_lb(ha_scale, instances):
    current = ""
    try:
        current = CADDY_PATH.read_text()
    except OSError:
        current = ""
    if ha_scale.instances_in_caddyfile(current) == list(instances):
        return True
    previous = current or None
    write_caddyfile(ha_scale, instances, CADDY_PATH)
    if subprocess.run([SYSTEMCTL, "is-active", "--quiet", "bizarre-lb"]).returncode != 0:
        return True
    if reload_caddy():
        return True
    if previous is not None:
        CADDY_PATH.write_text(previous)
        reload_caddy()
    return False


def tick():
    ha_scale = load_ha_scale()
    active = []
    conns = {}
    for instance in range(1, ha_scale.MAX_INSTANCES + 1):
        if is_active(instance):
            active.append(instance)
            conns[instance] = count_conns(ha_scale.port_for(instance))
    action, instance, state = ha_scale.decide(active, conns, load_state())
    save_state(state)
    print("active=%s conns=%s action=%s instance=%s" % (active, conns, action, instance))

    if action == "start":
        subprocess.run([SYSTEMCTL, "start", "gunicorn@%d" % instance], check=True)
        if not wait_health(ha_scale, instance):
            subprocess.run([SYSTEMCTL, "stop", "gunicorn@%d" % instance], check=False)
            print("instance %d failed health; stopped" % instance, file=sys.stderr)
            return 1
        active = sorted(set(active) | {instance})
        if not sync_lb(ha_scale, active):
            return 1
        return 0

    if action == "stop":
        remaining = [i for i in active if i != instance]
        if not remaining:
            print("refusing to drain the last instance", file=sys.stderr)
            return 1
        if not sync_lb(ha_scale, remaining):
            return 1
        subprocess.run([SYSTEMCTL, "stop", "gunicorn@%d" % instance], check=True)
        return 0

    if active and not sync_lb(ha_scale, active):
        return 1
    return 0


def render_cli(argv):
    ha_scale = load_ha_scale()
    ids = [int(part) for part in argv[2].split(",") if part]
    path = Path(argv[3]) if len(argv) > 3 else CADDY_PATH
    write_caddyfile(ha_scale, ids, path)
    print(path)
    return 0


def wait_cli(argv):
    port = int(argv[2])
    url = "http://127.0.0.1:%d/api/health/" % port
    for _ in range(20):
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return 0
        except OSError:
            time.sleep(0.5)
    print("health failed for %s" % url, file=sys.stderr)
    return 1


def main(argv):
    if len(argv) >= 2 and argv[1] == "render":
        return render_cli(argv)
    if len(argv) >= 2 and argv[1] == "wait":
        return wait_cli(argv)
    return tick()


if __name__ == "__main__":
    sys.exit(main(sys.argv))
