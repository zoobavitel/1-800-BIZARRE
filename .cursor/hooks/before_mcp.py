#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ask, allow, deny, read_stdin_json  # noqa: E402


def main() -> None:
    data = read_stdin_json()
    tool = str(
        data.get("tool_name")
        or data.get("toolName")
        or data.get("mcp_tool")
        or data.get("name")
        or ""
    ).lower()
    server = str(data.get("server") or data.get("mcp_server") or data.get("namespace") or "").lower()

    blob = f"{server} {tool}"

    if any(x in blob for x in ("mcp_auth", "delete_repo", "force_push")):
        deny(f"MCP call blocked: {server}/{tool}")

    # Browser can navigate anywhere; ask when mutating
    if "browser" in server or "browser_" in tool:
        if any(x in tool for x in ("click", "type", "fill", "navigate", "press", "drag")):
            ask(f"Browser MCP action: {tool} — confirm target")

    if any(x in blob for x in ("subscribe_", "unsubscribe", "create_repo")):
        ask(f"MCP side-effect: {server}/{tool}")

    allow()


if __name__ == "__main__":
    main()
