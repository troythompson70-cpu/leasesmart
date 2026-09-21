#!/usr/bin/env bash
# Install a macOS LaunchAgent: one Graph Inbox GET every 60s.
# Copies the runner into $HOME/.tgt-mailbox-coverage so launchd is not blocked
# from executing files under Documents (exit 126 Operation not permitted).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEBSITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$WEBSITE_ROOT/.." && pwd)"
DEST="$HOME/.tgt-mailbox-coverage"
LOG_DIR="$DEST"
LABEL="com.tgttechnologies.mailbox-coverage"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
mkdir -p "$DEST" "$HOME/Library/LaunchAgents"
chmod +x "$SCRIPT_DIR/mailbox-coverage-once.sh" "$SCRIPT_DIR/promote-on-mailbox-200.sh"

NODE_BIN=""
for candidate in \
  "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" \
  /usr/local/bin/node \
  /opt/homebrew/bin/node
do
  if [[ -x "$candidate" ]]; then
    NODE_BIN="$candidate"
    break
  fi
done
if [[ -z "$NODE_BIN" ]]; then
  echo "install-mailbox-coverage-watch: no node binary found" >&2
  exit 1
fi

GH_BIN=""
for candidate in \
  /tmp/gh_2.81.0_macOS_amd64/bin/gh \
  /opt/homebrew/bin/gh \
  /usr/local/bin/gh
do
  if [[ -x "$candidate" ]]; then
    GH_BIN="$candidate"
    break
  fi
done

printf -v NODE_BIN_Q '%q' "$NODE_BIN"
printf -v GH_BIN_Q '%q' "$GH_BIN"
printf -v LOG_DIR_Q '%q' "$LOG_DIR"
printf -v WEBSITE_ROOT_Q '%q' "$WEBSITE_ROOT"
printf -v SCRIPT_DIR_Q '%q' "$SCRIPT_DIR"
printf -v REPO_ROOT_Q '%q' "$REPO_ROOT"

cat >"$DEST/mailbox-coverage-once.sh" <<EOF
#!/usr/bin/env bash
set -u
export TGT_NODE_BIN=${NODE_BIN_Q}
export TGT_GH_BIN=${GH_BIN_Q}
export TGT_MAILBOX_WATCH_LOG_DIR=${LOG_DIR_Q}
LOG_FILE=${LOG_DIR_Q}/mailbox-coverage.log
LOCKDIR=${LOG_DIR_Q}/once.lockdir
mkdir -p ${LOG_DIR_Q}
if ! mkdir "\$LOCKDIR" 2>/dev/null; then
  echo "[\$(date -u +%Y-%m-%dT%H:%M:%SZ)] NOT VERIFIED skip overlapping tick" >>"\$LOG_FILE"
  exit 0
fi
trap 'rmdir "\$LOCKDIR" 2>/dev/null || true' EXIT
cd ${WEBSITE_ROOT_Q}
set +e
"\$TGT_NODE_BIN" --experimental-strip-types ${SCRIPT_DIR_Q}/mailbox-coverage-watch.mjs >>"\$LOG_FILE" 2>&1
code=\$?
set -e
if [[ "\$code" -eq 0 ]]; then
  date -u +%Y-%m-%dT%H:%M:%SZ >${LOG_DIR_Q}/VERIFIED-HTTP-200
  ${SCRIPT_DIR_Q}/promote-on-mailbox-200.sh ${REPO_ROOT_Q} >>"\$LOG_FILE" 2>&1 || true
fi
exit 0
EOF
chmod +x "$DEST/mailbox-coverage-once.sh"

cat >"$DEST/mailbox-coverage-loop.sh" <<EOF
#!/usr/bin/env bash
set -u
export TGT_NODE_BIN=${NODE_BIN_Q}
export TGT_GH_BIN=${GH_BIN_Q}
export TGT_MAILBOX_WATCH_LOG_DIR=${LOG_DIR_Q}
LOG_FILE=${LOG_DIR_Q}/mailbox-coverage.log
mkdir -p ${LOG_DIR_Q}
cd ${WEBSITE_ROOT_Q}
set +e
"\$TGT_NODE_BIN" --experimental-strip-types ${SCRIPT_DIR_Q}/mailbox-coverage-watch.mjs --loop >>"\$LOG_FILE" 2>&1
code=\$?
set -e
if [[ "\$code" -eq 0 ]]; then
  date -u +%Y-%m-%dT%H:%M:%SZ >${LOG_DIR_Q}/VERIFIED-HTTP-200
  ${SCRIPT_DIR_Q}/promote-on-mailbox-200.sh ${REPO_ROOT_Q} >>"\$LOG_FILE" 2>&1 || true
fi
exit "\$code"
EOF
chmod +x "$DEST/mailbox-coverage-loop.sh"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>${DEST}/mailbox-coverage-loop.sh</string>
  </array>
  <key>WorkingDirectory</key><string>${WEBSITE_ROOT}</string>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${LOG_DIR}/launchd.out</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/launchd.err</string>
</dict></plist>
EOF

UID_NUM="$(id -u)"
launchctl bootout "gui/${UID_NUM}" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/${UID_NUM}" "$PLIST"
echo "Installed ${LABEL} (KeepAlive serial --loop, runner ${DEST}/mailbox-coverage-loop.sh)."
echo "Logs: ${DEST}/mailbox-coverage.log"
