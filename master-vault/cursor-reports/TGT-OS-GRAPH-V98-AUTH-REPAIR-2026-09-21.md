# TGT OS Graph — production truth correction (2026-09-21)

**Source:** Independent ChatGPT AppDeploy inspection + Cursor repair package  
**Status recorded:** `OWNER_ACTION_REQUIRED: GRAPH_SERVICE_IDENTITY_REPAIR` (pre-apply)  
**Freeze:** v98 / `1789910277389` `FROZEN_FOR_GRAPH_REPAIR`  
**Rollback-only:** v44 / `1789734343421`

## Corrected facts vs Sep 18 handoff

| Item | Sep 18 handoff | Sep 21 truth |
|------|----------------|--------------|
| Live version | assumed v44 locked | **v98 / 1789910277389** |
| Public API URL | 402 credit block | still 404 publicly |
| Authenticated AppDeploy | unavailable to Cursor | **working for ChatGPT** |
| Secret **names** | missing | **all four present** |
| Actual failure | credit block | **AADSTS7000215 / HTTP 401** |
| Cron | n/a | `sledgehammer-production-sweep-v3` disabled after 10 failures |
| Root defect | secrets missing | **hard-coded tenant/client IDs in `backend/graph-auth.ts`** |

## Cursor deliverable (this branch)

- Drop-in: `tgt-os-graph/appdeploy/graph-auth.ts`
- Transplant notes: `tgt-os-graph/appdeploy/GRAPH-AUTH-TRANSPLANT.md`
- Local AUTH adapter tests (mock `secrets.readSecret`) — not production VERIFIED

## Not done in this Cursor session

- No AppDeploy MCP / no write to live `backend/graph-auth.ts`
- No production AUTH_TEST
- Cron remains disabled (correct)
- No VERIFIED claim
