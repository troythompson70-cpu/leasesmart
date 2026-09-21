#!/usr/bin/env bash
# One Graph Inbox GET. Intended for launchd StartInterval=60 / manual oneshot.
# Fresh process = fresh token. Prefer KeepAlive --loop for the durable watch.
set -u
LOG_DIR="${TGT_MAILBOX_WATCH_LOG_DIR:-$HOME/.tgt-mailbox-coverage}"
LOCKDIR="$LOG_DIR/once.lockdir"
STAMP_DIR="$LOG_DIR"
LOG_FILE="$LOG_DIR/mailbox-coverage.log"
mkdir -p "$LOG_DIR"
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] NOT VERIFIED skip overlapping tick" >>"$LOG_FILE"
  exit 0
fi
trap 'rmdir "$LOCKDIR" 2>/dev/null || true' EXIT

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEBSITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$WEBSITE_ROOT/.." && pwd)"
NODE_BIN=""
for candidate in \
  "${TGT_NODE_BIN:-}" \
  "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" \
  /usr/local/bin/node \
  /opt/homebrew/bin/node
do
  if [[ -n "$candidate" && -x "$candidate" ]]; then
    NODE_BIN="$candidate"
    break
  fi
done
if [[ -z "$NODE_BIN" ]]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] NOT VERIFIED node binary missing" >>"$LOG_FILE"
  exit 3
fi

cd "$WEBSITE_ROOT"
set +e
"$NODE_BIN" --experimental-strip-types "$SCRIPT_DIR/mailbox-coverage-watch.mjs" >>"$LOG_FILE" 2>&1
code=$?
set -e

if [[ "$code" -eq 0 ]]; then
  date -u +%Y-%m-%dT%H:%M:%SZ >"$STAMP_DIR/VERIFIED-HTTP-200"
  "$SCRIPT_DIR/promote-on-mailbox-200.sh" "$REPO_ROOT" >>"$LOG_FILE" 2>&1 || true
fi
exit 0
