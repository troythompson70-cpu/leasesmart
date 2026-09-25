# TGT OS Graph — production truth (2026-09-21 late)

**Sources:** Troy AppDeploy inspection + Cursor vault continuation  
**Status:** `READY_FOR_PRODUCTION_AUTH_TEST`  
**Live version:** **v98 / `1790006649557`** (deployed ~2026-09-21 12:04 PM ET)  
**Prior freeze id (superseded as newest):** `1789910277389`  
**Rollback-only:** v44 / `1789734343421` — **do not roll back**  
**Claude:** **SUSPENDED — DO NOT USE**

## Facts

| Item | State |
|------|--------|
| Production `backend/graph-auth.ts` | **PATCHED** — reads `GRAPH_TENANT_ID` + `GRAPH_CLIENT_ID` + `GRAPH_CLIENT_SECRET` from AppDeploy secrets; hard-coded IDs gone |
| AppDeploy QA | **READY** — 0 FE / 0 BE / 0 network |
| Code-side Graph identity defect | **CORRECTED** |
| Live Entra client-secret acceptance | **UNPROVEN** after repair |
| Cron `sledgehammer-production-sweep-v3` | **DISABLED** (old AADSTS7000215 / HTTP 401 failure state) |
| Local Cursor suite | 28/28 PASS — **not** live token proof |
| UI work | Do not restart |

## Next wall

Prove the stored Entra client-secret credential against Microsoft:

`live AUTH_TEST → Graph Mail.Read → inbox/sent reconciliation → Command Center readback → replay creates=0 → re-enable Sledgehammer cron → independent verification`

Runbook: `master-vault/cursor-reports/TGT-OS-GRAPH-READY-FOR-AUTH-TEST-2026-09-21.md`
