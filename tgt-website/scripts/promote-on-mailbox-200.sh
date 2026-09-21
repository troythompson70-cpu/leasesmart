#!/usr/bin/env bash
# Runs only after mailbox-coverage-once.sh saw Graph HTTP 200.
# Merges LeaseSmart PR #27. Does not POST production /api/intake.
# Apex promotion is git-merge of the held PR — Netlify/host follows the merge.
set -u
REPO_ROOT="${1:-}"
if [[ -z "$REPO_ROOT" || ! -d "$REPO_ROOT/.git" ]]; then
  echo "promote-on-mailbox-200: repo root missing"
  exit 1
fi
STAMP="${TGT_MAILBOX_WATCH_LOG_DIR:-$HOME/.tgt-mailbox-coverage}/VERIFIED-HTTP-200"
if [[ ! -f "$STAMP" ]]; then
  echo "promote-on-mailbox-200: no VERIFIED-HTTP-200 stamp; refusing merge"
  exit 1
fi
DONE="${TGT_MAILBOX_WATCH_LOG_DIR:-$HOME/.tgt-mailbox-coverage}/PROMOTED"
if [[ -f "$DONE" ]]; then
  echo "promote-on-mailbox-200: already promoted $(cat "$DONE")"
  exit 0
fi

GH_BIN=""
for candidate in \
  "${TGT_GH_BIN:-}" \
  /tmp/gh_2.81.0_macOS_amd64/bin/gh \
  /opt/homebrew/bin/gh \
  /usr/local/bin/gh \
  "$(command -v gh 2>/dev/null || true)"
do
  if [[ -n "$candidate" && -x "$candidate" ]]; then
    GH_BIN="$candidate"
    break
  fi
done
if [[ -z "$GH_BIN" ]]; then
  echo "promote-on-mailbox-200: gh missing; merge not executed. Stamp remains at $STAMP"
  exit 1
fi

echo "promote-on-mailbox-200: merging PR #27 after Graph Inbox HTTP 200"
if "$GH_BIN" pr merge 27 --repo troythompson70-cpu/leasesmart --merge --delete-branch=false; then
  date -u +%Y-%m-%dT%H:%M:%SZ >"$DONE"
  echo "promote-on-mailbox-200: PR #27 merge requested"
  PLIST="$HOME/Library/LaunchAgents/com.tgttechnologies.mailbox-coverage.plist"
  if [[ -f "$PLIST" ]]; then
    launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
    echo "promote-on-mailbox-200: launchd mailbox watch unloaded"
  fi
else
  echo "promote-on-mailbox-200: gh pr merge failed; watch will retry next minute"
  exit 1
fi
