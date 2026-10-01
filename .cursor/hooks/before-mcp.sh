#!/usr/bin/env bash
# beforeMCPExecution — ask on mutating MCP; deny auth sprawl patterns.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export CURSOR_PROJECT_DIR="${CURSOR_PROJECT_DIR:-$ROOT}"
exec python3 "$(dirname "$0")/before_mcp.py"
