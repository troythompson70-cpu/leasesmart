# TGT Agent Operating Model — 2026-09-21

**Effective immediately. Supersedes all “send to Claude” / “Claude architect” instructions.**

## Claude status

**SUSPENDED** — routing status: **DO NOT USE**.

Do not assign Claude: architecture review, engineering review, handoffs, risk/security review, production verification, coding tasks, status requests, or any TGT / LeaseSmart work.

## Active roles

| Role | Agent |
|------|--------|
| Project Manager / Orchestrator | ChatGPT |
| Architecture / Risk / Security Reviewer | Gemini |
| Implementation / Patch Executor | Cursor |
| Canonical operational record | Microsoft 365 / SharePoint |
| Independent Verifier | Separate from architect + implementer |
| CEO / Product Owner / Final approval | Troy |

## Command center priority (current)

**Microsoft Graph / AppDeploy** — code identity defect **CLOSED**; next wall is live Entra credential proof.

- Live: **v98 / `1790006649557`** (AppDeploy READY 0/0/0)
- Production `backend/graph-auth.ts`: reads all three Graph secrets (hard-coded IDs gone)
- Status: `READY_FOR_PRODUCTION_AUTH_TEST`
- Cron `sledgehammer-production-sweep-v3`: **remains disabled** until AUTH_OK + replay creates=0
- Sequence: live AUTH_TEST → Mail.Read → reconcile → Command Center readback → replay creates=0 → re-enable cron → independent verification
- Do **not** roll back · do **not** restart UI work · do **not** wait for Claude
- Parked TGT OS agent/blueprint sprint: still parked unless Troy resumes it
- Runbook: `master-vault/cursor-reports/TGT-OS-GRAPH-READY-FOR-AUTH-TEST-2026-09-21.md`

## Replacement architect

**Gemini** (not Claude).
