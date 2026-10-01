#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ask, allow, deny, read_stdin_json, shell_policy  # noqa: E402


def main() -> None:
    data = read_stdin_json()
    command = data.get("command") or data.get("cmd") or ""
    if not command:
        allow()
    permission, message = shell_policy(command)
    if permission == "deny":
        deny(message, f"Hook denied shell: {message}")
    if permission == "ask":
        ask(message, f"Hook asks approval: {message}")
    allow()


if __name__ == "__main__":
    main()
