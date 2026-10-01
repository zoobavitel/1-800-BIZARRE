#!/usr/bin/env bash
# beforeShellExecution — deny catastrophic commands; ask on gray area.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export CURSOR_PROJECT_DIR="${CURSOR_PROJECT_DIR:-$ROOT}"
exec python3 "$(dirname "$0")/before_shell.py"
