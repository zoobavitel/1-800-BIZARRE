#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (  # noqa: E402
    ask,
    allow,
    deny,
    is_protected_guardrail_path,
    is_rules_path,
    read_stdin_json,
    shell_policy,
)


def _path_from_input(data: dict) -> str:
    inp = data.get("input") or data.get("arguments") or {}
    if isinstance(inp, dict):
        for key in ("path", "file_path", "filePath", "target_notebook"):
            if inp.get(key):
                return str(inp[key])
    return str(data.get("file_path") or data.get("path") or "")


def main() -> None:
    data = read_stdin_json()
    tool = str(data.get("tool_name") or data.get("toolName") or data.get("tool") or "")
    path = _path_from_input(data)

    # Self-protection: never let the agent edit hooks
    if tool in ("Write", "StrReplace", "Delete", "EditNotebook", "DeleteFile"):
        if path and is_protected_guardrail_path(path):
            deny(
                f"Refusing to modify guardrail file via {tool}: {path}",
                "Agents must not edit .cursor/hooks* — change guardrails in a human-reviewed PR only.",
            )
        if path and is_rules_path(path) and tool in ("Delete", "DeleteFile"):
            deny(f"Refusing to delete Cursor rules: {path}")
        if path and is_rules_path(path):
            ask(
                f"Editing Cursor rules via {tool}: {path}",
                "Rule changes need human review.",
            )

    # Shell also goes through beforeShellExecution; belt-and-suspenders here
    if tool == "Shell":
        inp = data.get("input") or data.get("arguments") or {}
        command = ""
        if isinstance(inp, dict):
            command = str(inp.get("command") or "")
        if command:
            permission, message = shell_policy(command)
            if permission == "deny":
                deny(message)
            if permission == "ask":
                ask(message)

    allow()


if __name__ == "__main__":
    main()
