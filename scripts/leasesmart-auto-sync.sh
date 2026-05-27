#!/bin/bash
REPO="/Users/macp/Documents/GitHub/leasesmart"
LOG="$REPO/master-vault/morning/auto-sync-log.txt"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "=== LeaseSmart Auto-Sync — $TIMESTAMP ===" >> "$LOG"
cd "$REPO" && git pull origin main >> "$LOG" 2>&1 && echo "✅ Git pull done" >> "$LOG"
node "$REPO/scripts/morning-checklist.mjs" >> "$LOG" 2>&1 && echo "✅ Checklist done" >> "$LOG"
node "$REPO/scripts/ai-context-export.mjs" >> "$LOG" 2>&1 && echo "✅ AI context done" >> "$LOG"
echo "--- Complete: $TIMESTAMP ---" >> "$LOG"
