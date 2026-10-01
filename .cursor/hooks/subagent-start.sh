#!/usr/bin/env bash
# subagentStart — ask before shell-capable / cloud subagents.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export CURSOR_PROJECT_DIR="${CURSOR_PROJECT_DIR:-$ROOT}"
exec python3 "$(dirname "$0")/subagent_start.py"
