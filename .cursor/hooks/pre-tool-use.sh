#!/usr/bin/env bash
# preToolUse — protect guardrail files; gate destructive tools.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export CURSOR_PROJECT_DIR="${CURSOR_PROJECT_DIR:-$ROOT}"
exec python3 "$(dirname "$0")/pre_tool_use.py"
