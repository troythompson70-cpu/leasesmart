# TGT Orchestrator — Automation Foundation (AIWO-006)

Canonical loop:

```
365 WORK QUEUE → CLAIM → LOCK → HEARTBEAT → EXECUTE → TEST → EVIDENCE
→ READY_FOR_REVIEW → Claude / AI Auditor → VERIFIED → next work order
```

Workers never mark their own work `VERIFIED`.

### 24/7 watchdog vs approval gates

“Agents running 24/7” must **not** mean blindly retrying the same broken operation.

| Class | Behavior |
|-------|----------|
| **Recoverable** (timeouts, flaky exec, stale locks) | Watchdog may clear the lock and schedule `READY` / automatic retry up to `max_retries` |
| **Approval gates** — authentication, payment, MFA, legal, insurance, owner-approval | Stop at `WAITING_EXTERNAL` with `approval_required=YES`. No automatic retry. No reclaim without audited `force_reclaim_review` after a human clears the gate |

Bypassing those gates is forbidden. Classifier: `approval_gates.py`.

## Package

| File | Role |
|------|------|
| `state_machine.py` | Legal status transitions; blocks worker self-verify |
| `approval_gates.py` | Classifies recoverable vs stop-at-approval failures |
| `queue_engine.py` | Atomic claim/lock, heartbeat, stale recovery, retry, handoff |
| `checkpoint.py` | ERR-ORCH-006/007 progress checkpoint + completion evidence guards |
| `evidence.py` | Evidence write + read-back proof + sha256 audit pin |
| `audit_log.py` | Append-only `queue_audit.jsonl` |
| `tgt_orchestrator.py` | CLI entry (run-once overlap lock + in-agent heartbeats) |
| `install_tgt_orchestrator.sh` | macOS LaunchAgent or Linux systemd/cron (5 min, flock guard) |

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
