#!/usr/bin/env python3
"""Offline tests for agent safety hooks. Run: python3 .cursor/hooks/test_hooks.py"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HOOKS = Path(__file__).resolve().parent


def run_hook(script: str, payload: dict) -> tuple[int, dict]:
    proc = subprocess.run(
        [str(HOOKS / script)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )
    out = {}
    if proc.stdout.strip():
        try:
            out = json.loads(proc.stdout)
        except json.JSONDecodeError:
            out = {"_stdout": proc.stdout}
    return proc.returncode, out


def expect(script: str, payload: dict, permission: str, label: str) -> None:
    code, out = run_hook(script, payload)
    got = out.get("permission")
    if permission == "deny":
        ok = got == "deny" or code == 2
    else:
        ok = got == permission and code == 0
    if not ok:
        raise AssertionError(f"{label}: want permission={permission}, got {got!r} code={code} out={out}")


def main() -> int:
    # Shell denies
    expect(
        "before-shell.sh",
        {"command": "rm -rf /"},
        "deny",
        "rm root",
    )
    expect(
        "before-shell.sh",
        {"command": "git push --force origin master"},
        "deny",
        "force push",
    )
    expect(
        "before-shell.sh",
        {"command": "git reset --hard HEAD~3"},
        "deny",
        "reset hard",
    )
    expect(
        "before-shell.sh",
        {"command": "ssh root@pve2"},
        "deny",
        "ssh root pve",
    )
    expect(
        "before-shell.sh",
        {"command": "rm -rf /opt/bizarre-prod"},
        "deny",
        "rm prod tree",
    )

    # Shell ask
    expect(
        "before-shell.sh",
        {"command": "ssh bizarre-api-agent"},
        "ask",
        "ssh agent host",
    )
    expect(
        "before-shell.sh",
        {"command": "rm -rf /opt/bizarre/tmp-scratch"},
        "ask",
        "rm inside workspace",
    )

    # Shell allow
    expect(
        "before-shell.sh",
        {"command": "git status"},
        "allow",
        "git status",
    )

    # Read secrets
    expect(
        "before-read-file.sh",
        {"path": "/etc/bizarre/prod.env"},
        "deny",
        "read prod.env",
    )

    # Guardrail self-protect
    expect(
        "pre-tool-use.sh",
        {"tool_name": "Write", "input": {"path": ".cursor/hooks.json", "contents": "{}"}},
        "deny",
        "write hooks.json",
    )
    expect(
        "pre-tool-use.sh",
        {"tool_name": "Delete", "input": {"path": ".cursor/hooks/before-shell.sh"}},
        "deny",
        "delete hook script",
    )

    # Subagent
    expect(
        "subagent-start.sh",
        {"subagent_type": "explore"},
        "allow",
        "explore allow",
    )
    expect(
        "subagent-start.sh",
        {"subagent_type": "shell"},
        "ask",
        "shell ask",
    )

    # MCP
    expect(
        "before-mcp.sh",
        {"server": "cursor-ide-browser", "tool_name": "browser_click"},
        "ask",
        "browser click ask",
    )

    print("OK — all hook policy tests passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
