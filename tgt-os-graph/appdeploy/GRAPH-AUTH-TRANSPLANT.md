# AppDeploy transplant — graph-auth repair (APPLIED)

**Live production:** `tgt-operating-system-wjjsv6` **v98 / `1790006649557`**  
**AppDeploy QA:** READY (0 FE / 0 BE / 0 network)  
**Code-side status:** **APPLIED** — production `backend/graph-auth.ts` reads all three secrets; hard-coded IDs gone  
**Operational status:** `READY_FOR_PRODUCTION_AUTH_TEST`  
**Rollback-only:** v44 / `1789734343421` — **do not roll back**  
**Cron:** `sledgehammer-production-sweep-v3` remains **disabled** until AUTH_OK + replay creates=0

## Root cause (historical)

`backend/graph-auth.ts` hard-coded `GRAPH_TENANT_ID` + `GRAPH_CLIENT_ID` and read only `GRAPH_CLIENT_SECRET` from AppDeploy secrets → Microsoft `AADSTS7000215` / HTTP 401.

## Repair — DONE in production

Production now loads:

1. `GRAPH_TENANT_ID` ← `secrets.readSecret('GRAPH_TENANT_ID')`
2. `GRAPH_CLIENT_ID` ← `secrets.readSecret('GRAPH_CLIENT_ID')`
3. `GRAPH_CLIENT_SECRET` ← `secrets.readSecret('GRAPH_CLIENT_SECRET')`

Repo reference drop-in (for audit / future ports): `tgt-os-graph/appdeploy/graph-auth.ts`

## Next wall (not code transplant)

Prove the stored Entra client-secret against Microsoft. See:

`master-vault/cursor-reports/TGT-OS-GRAPH-READY-FOR-AUTH-TEST-2026-09-21.md`

Sequence: live AUTH_TEST → Mail.Read → reconcile → Command Center readback → replay creates=0 → re-enable cron → independent verification.

**Claude suspended.** ChatGPT orchestrates; Independent Verifier runs live gates; Gemini residual risk only.
