#!/usr/bin/env bash
# beforeReadFile — block secret / prod credential reads.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export CURSOR_PROJECT_DIR="${CURSOR_PROJECT_DIR:-$ROOT}"
exec python3 "$(dirname "$0")/before_read_file.py"
