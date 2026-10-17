#!/bin/bash
# Sample container cgroup plus gunicorn and Postgres RSS once a second.
# /proc/loadavg on this LXC can describe the Proxmox host. Do not use it.
# See docs/TEST_PYRAMID.md
set -euo pipefail

OUT=${1:-/tmp/bizarre-perf-sample.csv}
CPU_STAT=${CPU_STAT:-/sys/fs/cgroup/cpu.stat}
MEM_CURRENT=${MEM_CURRENT:-/sys/fs/cgroup/memory.current}

if [[ ! -r "$CPU_STAT" || ! -r "$MEM_CURRENT" ]]; then
  echo "cgroup files missing ($CPU_STAT, $MEM_CURRENT)" >&2
  exit 1
fi

echo "ts,cpu_usage_usec,mem_bytes,live_rss_kb,perf_rss_kb,pg_rss_kb" > "$OUT"
echo "writing $OUT"

sum_rss() {
  local match="$1"
  ps -eo rss,args | awk -v m="$match" 'index($0, m) {s+=$1} END {print s+0}'
}

while true; do
  usec=$(awk '/^usage_usec / {print $2}' "$CPU_STAT")
  mem=$(cat "$MEM_CURRENT")
  live=$(sum_rss "127.0.0.1:8000")
  perf=$(sum_rss "127.0.0.1:8001")
  pg=$(sum_rss "postgres:")
  echo "$(date +%s),${usec:-0},${mem:-0},${live},${perf},${pg}" >> "$OUT"
  sleep 1
done
