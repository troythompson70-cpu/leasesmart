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

## 2026-09-22 — AADSTS900023 / MAILBOX GAP (tenant VALUE)

**Symptom:** Reconcile → MAILBOX GAP; ChatGPT probe → `HTTP 400 AADSTS900023`.  
**Meaning:** Token URL tenant segment is not a valid Directory GUID/domain. Repeating Secrets UI paste alone did not clear it.

**Drop-in fix (apply to production `backend/graph-auth.ts`):**
1. `normalizeGraphTenantId` — strip BOM, quotes, `{…}` braces, whitespace.
2. `assertValidGraphTenantId` — require GUID or domain **before** calling Microsoft.
3. Map `AADSTS900023` → `OWNER_ACTION_REQUIRED: GRAPH_TENANT_ID_REPAIR`.

Repo source: `tgt-os-graph/appdeploy/graph-auth.ts`  
ChatGPT/AppDeploy: replace production `backend/graph-auth.ts` with that file (or merge the three helpers), deploy, clear token cache / restart backend if needed, then Reconcile.

## Next wall (after tenant accepts)

Prove the stored Entra client-secret against Microsoft. See:

`master-vault/cursor-reports/TGT-OS-GRAPH-READY-FOR-AUTH-TEST-2026-09-21.md`

Sequence: live AUTH_TEST → Mail.Read → reconcile → Command Center readback → replay creates=0 → re-enable cron → independent verification.

**Claude suspended.** ChatGPT orchestrates; Independent Verifier runs live gates; Gemini residual risk only.
