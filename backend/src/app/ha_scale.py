"""How many gunicorn instances bizarre-api should run.

Instances 1 and 2 are the floor. One process can die and the other keeps
serving. Instances 3 and 4 exist only while every running instance stays
busy, and the highest extra instance stops only after it stays idle.

This module imports nothing from Django so the scaler can load it without
starting the app.
"""

MIN_INSTANCES = 2
MAX_INSTANCES = 4
# Each instance is one gthread worker with 32 threads. 24 established
# connections means that instance is near full of API calls and SSE streams.
HIGH_CONNS = 24
LOW_CONNS = 2
HIGH_TICKS = 2
LOW_TICKS = 6
BASE_PORT = 8000
LISTEN = "127.0.0.1:8000"
ADMIN = "127.0.0.1:2021"


def port_for(instance):
    return BASE_PORT + instance


def decide(active, conns, state):
    """Return ``(action, instance, new_state)``.

    ``action`` is ``start``, ``stop``, or ``hold``. ``instance`` is an int
    or None. The input state is not modified.
    """
    active_set = set(active)
    low = {int(k): int(v) for k, v in state.get("low_streak", {}).items()}

    missing_floor = [
        i for i in range(1, MIN_INSTANCES + 1) if i not in active_set
    ]
    if missing_floor:
        return "start", missing_floor[0], _state(0, low)

    high = int(state.get("high_streak", 0))
    if (
        active_set
        and len(active_set) < MAX_INSTANCES
        and all(conns.get(i, 0) >= HIGH_CONNS for i in active_set)
    ):
        high += 1
    else:
        high = 0

    if high >= HIGH_TICKS:
        nxt = _next_hole(active_set)
        if nxt is not None:
            return "start", nxt, _state(0, low)

    extras = sorted(i for i in active_set if i > MIN_INSTANCES)
    low = {i: n for i, n in low.items() if i in extras}
    if extras:
        top = extras[-1]
        if conns.get(top, 0) <= LOW_CONNS:
            low[top] = low.get(top, 0) + 1
        else:
            low[top] = 0
        if low[top] >= LOW_TICKS:
            low.pop(top, None)
            return "stop", top, _state(high, low)

    return "hold", None, _state(high, low)


def render_caddyfile(instances):
    """Caddyfile for the loopback pool. No upstream keepalive.

    Established connections are the scale signal. Idle keepalives would look
    like load. ``flush_interval -1`` lets campaign SSE through unbuffered.
    ``lb_try_duration`` retries a request on another instance while one
    restarts, instead of returning a 502.
    The forwarded protocol header is passed through so Funnel's https value
    still reaches Django.
    """
    if not instances:
        raise ValueError("refusing to render a pool with no instances")
    upstreams = " ".join(
        "127.0.0.1:%d" % port_for(i) for i in instances
    )
    listed = ",".join(str(i) for i in instances)
    return (
        "{\n"
        "\tadmin %s\n"
        "\tauto_https off\n"
        "}\n"
        "\n"
        "# instances: %s\n"
        "http://%s {\n"
        "\treverse_proxy %s {\n"
        "\t\tlb_policy least_conn\n"
        "\t\tlb_try_duration 5s\n"
        "\t\tlb_try_interval 250ms\n"
        "\t\thealth_uri /api/health/\n"
        "\t\thealth_interval 5s\n"
        "\t\thealth_timeout 2s\n"
        "\t\thealth_status 200\n"
        "\t\tfail_duration 15s\n"
        "\t\theader_up X-Forwarded-Proto {http.request.header.X-Forwarded-Proto}\n"
        "\t\tflush_interval -1\n"
        "\t\ttransport http {\n"
        "\t\t\tread_timeout 120s\n"
        "\t\t\twrite_timeout 120s\n"
        "\t\t}\n"
        "\t}\n"
        "}\n"
    ) % (ADMIN, listed, LISTEN, upstreams)


def instances_in_caddyfile(text):
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# instances:"):
            body = stripped.split(":", 1)[1].strip()
            if not body:
                return []
            return [int(part) for part in body.split(",")]
    return None


def _next_hole(active_set):
    for i in range(1, MAX_INSTANCES + 1):
        if i not in active_set:
            return i
    return None


def _state(high, low):
    return {"high_streak": high, "low_streak": dict(low)}
