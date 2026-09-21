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

Continue **Microsoft Graph / AppDeploy production repair** from known state:

- Freeze: **v98 / `1789910277389`** `FROZEN_FOR_GRAPH_REPAIR`
- Rollback-only: **v44 / `1789734343421`**
- Defect: hard-coded tenant/client IDs in AppDeploy `backend/graph-auth.ts` → `AADSTS7000215`
- Cursor deliverable: PR #28 drop-in `tgt-os-graph/appdeploy/graph-auth.ts`
- Status: `OWNER_ACTION_REQUIRED: APPDEPLOY_APPLY_GRAPH_AUTH`
- Cron `sledgehammer-production-sweep-v3`: **remains disabled** until AUTH_OK
- Do **not** restart completed UI work
- Do **not** wait for Claude
- Parked TGT OS agent/blueprint sprint: still parked unless Troy resumes it

## Replacement architect

**Gemini** (not Claude).
