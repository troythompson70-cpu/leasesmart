# Morning Review — 2026-09-21 — Graph v98 auth repair (Claude suspended)

**Build ID:** 20260921-graph-v98-auth-repair · **Branch:** `cursor/graph-auth-appdeploy-secrets-d437` · **PR:** #28

## Operating model (effective now)

| Role | Agent |
|------|--------|
| PM / Orchestrator | ChatGPT |
| Architecture / Risk | Gemini |
| Implementation | Cursor |
| Ops record | M365 / SharePoint |
| Claude | **SUSPENDED — DO NOT USE** |

## Dashboard — Graph / AppDeploy production repair

| Check | Result |
|-------|--------|
| Production freeze | **v98 / 1789910277389** `FROZEN_FOR_GRAPH_REPAIR` |
| Rollback-only | v44 / 1789734343421 |
| Root cause | Hard-coded tenant/client in `backend/graph-auth.ts` → **AADSTS7000215** |
| AppDeploy secret **names** | Present (ChatGPT inspection) |
| Cursor drop-in | Ready — `tgt-os-graph/appdeploy/graph-auth.ts` |
| Local tests | **28/28 PASS** |
| Production apply | **NOT DONE** — Cursor Lovable MCP sees 0 projects; ChatGPT must apply |
| Public preview URLs | 404 (expected publicly; authenticated AppDeploy is SoT) |
| Cron `sledgehammer-production-sweep-v3` | **DISABLED** (keep off until AUTH_OK) |
| VERIFIED | **No** |

## Status string

`OWNER_ACTION_REQUIRED: APPDEPLOY_APPLY_GRAPH_AUTH`

## Next actions (ordered)

1. **ChatGPT** — apply drop-in to AppDeploy `backend/graph-auth.ts` on frozen v98 (see transplant notes).
2. **Troy** — confirm Entra **TGT Command Center Production** client-secret **VALUE** matches the three AppDeploy Graph secrets (never paste into chat).
3. **Production AUTH_TEST** — then Independent Verifier readback (not Gemini if Gemini co-designed the auth path).
4. **Gemini** — architecture/risk review of hard-coded-ID defect class + secrets boundary (optional parallel; not a deploy gate if ChatGPT already has apply path).
5. Only after AUTH_OK: mailbox → ingest → visible readback → replay creates=0 → consider re-enabling cron.

## Do not

- Wait for Claude
- Restart completed UI work
- Re-enable sledgehammer cron before AUTH_OK
- Transplant PR #25 `process.env` auth literally into AppDeploy
- Claim VERIFIED from local unit tests alone
