# TGT OS Graph — Troy GO for production AUTH_TEST (2026-09-21)

**Troy command:** `go` (prior shorthand `usgo`)  
**Authorization:** **AUTHORIZED** to run the live AUTH_TEST sequence  
**Status:** `TROY_GO — AWAITING_APPDEPLOY_AUTH_TEST_EXECUTION`  
**Claude:** SUSPENDED — DO NOT USE  
**Do not:** roll back · restart UI · re-enable cron before AUTH_OK + replay creates=0 · claim VERIFIED without live proof

## Production baseline (unchanged)

| Item | Value |
|------|--------|
| App | `tgt-operating-system-wjjsv6` |
| Live | **v98 / `1790006649557`** |
| AppDeploy QA | READY 0/0/0 |
| `backend/graph-auth.ts` | PATCHED (all three secrets) |
| Code-side identity defect | CLOSED |
| Cron `sledgehammer-production-sweep-v3` | DISABLED until gates pass |

## Authorized sequence (execute now)

1. **live AUTH_TEST** — AppDeploy `runAuthTest()` / client_credentials → expect `AUTH_OK`
2. **Graph Mail.Read** (service identity)
3. **Inbox/Sent reconciliation**
4. **Command Center readback**
5. **Replay creates=0**
6. **Re-enable Sledgehammer cron** (only after 1–5)
7. **Independent verification**

## Cursor execution attempt (this GO turn)

| Probe | Result |
|-------|--------|
| Lovable MCP projects | **0** — cannot open AppDeploy |
| Public preview URLs | **404** |
| `GRAPH_*` in Cloud Agent | **MISSING** — cannot call login.microsoftonline.com as production app |
| 1Password MCP | **unavailable** |
| Live AUTH_TEST from Cursor | **BLOCKED** — ChatGPT / Independent Verifier must execute inside AppDeploy |

## Owner for immediate execution

**ChatGPT** (AppDeploy-authenticated) — run AUTH_TEST now under Troy GO.  
**Independent Verifier** — own pass/fail on live gates (not Gemini if Gemini co-designed auth).  
**Troy** — only if AUTH fails with `AADSTS7000215`: match Entra secret VALUE (never paste into chat).

## On AUTH_OK

Vault to SharePoint `11 APP BUILD`: code `AUTH_OK`, version `1790006649557`, then continue steps 2–7.

## On AUTH fail

Vault exact status code / `AADSTS*` (no secrets). Cron stays off. Status → `OWNER_ACTION_REQUIRED: GRAPH_SERVICE_IDENTITY_REPAIR`. No rollback.
