# AppDeploy transplant — graph-auth repair (v98 freeze)

**Production baseline:** `tgt-operating-system-wjjsv6` **v98 / 1789910277389** (`FROZEN_FOR_GRAPH_REPAIR`)  
**Rollback-only:** v44 / `1789734343421`  
**Do not** re-enable `sledgehammer-production-sweep-v3` until AUTH_TEST passes.

## Root cause (executed)

`backend/graph-auth.ts` hard-coded `GRAPH_TENANT_ID` + `GRAPH_CLIENT_ID` and read only `GRAPH_CLIENT_SECRET` from AppDeploy secrets → Microsoft `AADSTS7000215` / HTTP 401 when the stored secret did not belong to that hard-coded client.

## Repair (smallest auth boundary)

Replace production file:

`backend/graph-auth.ts`

with:

`tgt-os-graph/appdeploy/graph-auth.ts` from this repo

Behavior:

1. `GRAPH_TENANT_ID` ← `secrets.readSecret('GRAPH_TENANT_ID')`
2. `GRAPH_CLIENT_ID` ← `secrets.readSecret('GRAPH_CLIENT_ID')`
3. `GRAPH_CLIENT_SECRET` ← `secrets.readSecret('GRAPH_CLIENT_SECRET')`
4. No hard-coded UUIDs
5. No `process.env` for AppDeploy tenant secrets
6. Short-lived client_credentials token cache preserved
7. Never logs tokens/secrets
8. Maps `AADSTS7000215` → `OWNER_ACTION_REQUIRED: GRAPH_SERVICE_IDENTITY_REPAIR`

## Apply via AppDeploy (Cursor cannot write production this session)

**Claude is suspended — do not route this apply to Claude.**

| Role | Agent |
|------|--------|
| Apply / orchestrate | **ChatGPT** (authenticated AppDeploy access) |
| Architecture / risk | **Gemini** (review only; not production verifier if co-architect) |
| Package owner | **Cursor** (this drop-in + tests) |
| Secret VALUE confirmation | **Troy** (never paste into chat) |
| Production AUTH_TEST / readback | **Independent Verifier** |

ChatGPT apply steps:

1. Open app `tgt-operating-system-wjjsv6` at frozen v98 source.
2. Replace `backend/graph-auth.ts` with the drop-in contents (or equivalent import).
3. Update any imports if the old module exported different names — keep call sites on `getGraphAccessToken` / `clearGraphTokenCache` / `runAuthTest` if already used; otherwise re-export adapters as needed with the **smallest** call-site diff.
4. Deploy **only** this auth fix (no cron re-enable yet).
5. Troy: ensure Entra **TGT Command Center Production** client-secret **VALUE** (not Secret ID) matches the three AppDeploy secret values for that exact app+tenant.
6. Run AUTH_TEST in production (Independent Verifier — not Gemini if Gemini co-designed this path).
7. Only after AUTH_OK: mailbox read → reconcile → ingest → visible readback → replay creates=0 → then consider re-enabling sledgehammer cron.
8. Write AUTH result to SharePoint `TGT BUSINESS / TGT OPERATING SYSTEM / 11 APP BUILD`.

## PR #25 note

Do **not** transplant `tgt-os-graph/src/auth.js` (`process.env`) literally into AppDeploy. Use this `appdeploy/graph-auth.ts` adapter instead. Keep Outlook/SharePoint/ingest design from PR #25 for later gates after AUTH is green.

## Local evidence (not production VERIFIED)

```bash
cd tgt-os-graph && node --test tests/appdeploy-graph-auth.test.js
```
