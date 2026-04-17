#!/usr/bin/env bash
set -u

HOST="${1:-NS-FileDecryptor}"
COUNT="${2:-10}"
LOG_DIR="${LOG_DIR:-$(dirname "$0")/logs}"

mkdir -p "$LOG_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/ping-${HOST}-${TS}.log"

{
  echo "=== ping $HOST @ $TS (count=$COUNT) ==="
  ping -c "$COUNT" -W 2 "$HOST"
  rc=$?
  echo "=== exit=$rc ==="
  exit $rc
} | tee -a "$LOG_FILE"
