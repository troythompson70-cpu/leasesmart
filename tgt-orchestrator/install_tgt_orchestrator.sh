#!/usr/bin/env bash
# Install TGT orchestrator on macOS (LaunchAgent) or Linux (user systemd/cron).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="${HOME}/.tgt-orchestrator"
mkdir -p "$ROOT"

cp "$SCRIPT_DIR/tgt_orchestrator.py" "$ROOT/tgt_orchestrator.py"
cp "$SCRIPT_DIR/queue_engine.py" "$ROOT/queue_engine.py"
cp "$SCRIPT_DIR/state_machine.py" "$ROOT/state_machine.py"
cp "$SCRIPT_DIR/evidence.py" "$ROOT/evidence.py"
cp "$SCRIPT_DIR/audit_log.py" "$ROOT/audit_log.py"
cp "$SCRIPT_DIR/checkpoint.py" "$ROOT/checkpoint.py"
mkdir -p "$ROOT/tests/fixtures"
if [[ -d "$SCRIPT_DIR/tests" ]]; then
  cp -R "$SCRIPT_DIR/tests/." "$ROOT/tests/"
fi
chmod +x "$ROOT/tgt_orchestrator.py"

# Preserve optional env for repo/os discovery
ENV_FILE="$ROOT/env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
# Optional overrides
# export TGT_REPO=/absolute/path/to/command-center-repo
# export TGT_OS_ROOT=/absolute/path/to/TGT BUSINESS/TGT OPERATING SYSTEM
# export TGT_STALE_HEARTBEAT_SECONDS=1200
# export TGT_LOCK_SECONDS=1800
EOF
fi

UNAME="$(uname -s)"
if [[ "$UNAME" == "Darwin" ]]; then
  PLIST="$HOME/Library/LaunchAgents/com.tgttechnologies.orchestrator.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.tgttechnologies.orchestrator</string>
<key>ProgramArguments</key><array>
  <string>/bin/zsh</string>
  <string>-lc</string>
  <string>source "$ENV_FILE"; /usr/bin/env python3 "$ROOT/tgt_orchestrator.py" run-once</string>
</array>
<key>StartInterval</key><integer>300</integer>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>$ROOT/orchestrator.log</string>
<key>StandardErrorPath</key><string>$ROOT/orchestrator.err</string>
</dict></plist>
EOF
  launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  launchctl kickstart -k "gui/$(id -u)/com.tgttechnologies.orchestrator"
  echo "TGT orchestrator installed (macOS LaunchAgent, every 5 minutes)."
else
  # Linux: systemd user timer if available, else crontab
  if command -v systemctl >/dev/null 2>&1 && systemctl --user status >/dev/null 2>&1; then
    UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
    mkdir -p "$UNIT_DIR"
    cat > "$UNIT_DIR/tgt-orchestrator.service" <<EOF
[Unit]
Description=TGT AI Work Order Orchestrator

[Service]
Type=oneshot
EnvironmentFile=-$ENV_FILE
ExecStart=/usr/bin/env python3 $ROOT/tgt_orchestrator.py run-once
WorkingDirectory=$ROOT
EOF
    cat > "$UNIT_DIR/tgt-orchestrator.timer" <<EOF
[Unit]
Description=Run TGT orchestrator every 5 minutes

[Timer]
OnBootSec=60
OnUnitActiveSec=300
Unit=tgt-orchestrator.service

[Install]
WantedBy=timers.target
EOF
    systemctl --user daemon-reload
    systemctl --user enable --now tgt-orchestrator.timer
    echo "TGT orchestrator installed (systemd user timer, every 5 minutes)."
  elif command -v crontab >/dev/null 2>&1; then
    # Overlap guard: flock on a lockfile before run-once (AIWO-007 fix #4).
    cat > "$ROOT/run_once_guarded.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
source "$ENV_FILE" 2>/dev/null || true
exec 9>"$ROOT/run-once.lock"
if ! flock -n 9; then
  echo "[\$(date -Iseconds)] run-once skipped: already running" >> "$ROOT/orchestrator.log"
  exit 0
fi
/usr/bin/env python3 "$ROOT/tgt_orchestrator.py" run-once >> "$ROOT/orchestrator.log" 2>> "$ROOT/orchestrator.err"
EOF
    chmod +x "$ROOT/run_once_guarded.sh"
    CRON_LINE="*/5 * * * * $ROOT/run_once_guarded.sh"
    (crontab -l 2>/dev/null | grep -v 'tgt_orchestrator.py' | grep -v 'run_once_guarded.sh' || true; echo "$CRON_LINE") | crontab -
    echo "TGT orchestrator installed (crontab every 5 minutes, flock overlap guard)."
  else
    cat > "$ROOT/run_loop.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
# Fallback poll loop when systemd/crontab are unavailable (e.g. cloud agent VM).
source "$ENV_FILE" 2>/dev/null || true
while true; do
  /usr/bin/env python3 "$ROOT/tgt_orchestrator.py" run-once >> "$ROOT/orchestrator.log" 2>> "$ROOT/orchestrator.err" || true
  sleep 300
done
EOF
    chmod +x "$ROOT/run_loop.sh"
    echo "TGT orchestrator files installed."
    echo "No systemd user session or crontab available — start manually:"
    echo "  nohup $ROOT/run_loop.sh >/dev/null 2>&1 &"
    echo "Or single pass: python3 $ROOT/tgt_orchestrator.py run-once"
  fi
fi

echo "Validating discovery..."
/usr/bin/env python3 "$ROOT/tgt_orchestrator.py" validate || true
echo "Run selftest: python3 $ROOT/tgt_orchestrator.py selftest"
