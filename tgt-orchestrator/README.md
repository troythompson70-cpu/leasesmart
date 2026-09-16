# TGT Orchestrator — Automation Foundation (AIWO-006)

Canonical loop:

```
365 WORK QUEUE → CLAIM → LOCK → HEARTBEAT → EXECUTE → TEST → EVIDENCE
→ READY_FOR_REVIEW → Claude / AI Auditor → VERIFIED → next work order
```

Workers never mark their own work `VERIFIED`.

## Package

| File | Role |
|------|------|
| `state_machine.py` | Legal status transitions; blocks worker self-verify |
| `queue_engine.py` | Atomic claim/lock, heartbeat, stale recovery, retry, handoff |
| `evidence.py` | Evidence write + read-back proof |
| `audit_log.py` | Append-only `queue_audit.jsonl` |
| `tgt_orchestrator.py` | CLI entry |
| `install_tgt_orchestrator.sh` | macOS LaunchAgent or Linux systemd/cron (5 min) |

## Install (one-time)

```bash
cd tgt-orchestrator
chmod +x install_tgt_orchestrator.sh
./install_tgt_orchestrator.sh
```

Optional env (`~/.tgt-orchestrator/env`):

- `TGT_REPO` / `TGT_COMMAND_REPO` — Command Center git root
- `TGT_OS_ROOT` — path to synced `TGT BUSINESS/TGT OPERATING SYSTEM`
- `TGT_STALE_HEARTBEAT_SECONDS` (default 1200)
- `TGT_LOCK_SECONDS` (default 1800)

## CLI

```bash
python3 tgt_orchestrator.py validate
python3 tgt_orchestrator.py selftest
python3 tgt_orchestrator.py claim AIWO-006 --owner Cursor
python3 tgt_orchestrator.py recover-stale
python3 tgt_orchestrator.py run-once
python3 tgt_orchestrator.py run-once --foundation-only
```

## Tests

```bash
python3 -m unittest discover -s tests -v
```
