# Debug report — Graph AUTH_TEST gate (2026-09-21)

**Command:** `/debug`  
**Authoritative status (unchanged):** `TROY_GO — AWAITING_APPDEPLOY_AUTH_TEST_EXECUTION`  
**Claude:** SUSPENDED — DO NOT USE  
**Code change from this debug:** **NONE** (diagnosis only)

## Causal chain

1. Historical production failure: hard-coded tenant/client IDs + secret from store → `AADSTS7000215` → cron disabled.  
2. Code patched on AppDeploy v98 / `1790006649557` (Troy inspection).  
3. Troy authorized live AUTH_TEST (`go`).  
4. Live token proof still required.  
5. **Cursor Cloud and ChatGPT empty workspace cannot invoke AppDeploy `runAuthTest()`.**  
6. Therefore status remains awaiting AppDeploy-authenticated execution. Cron correctly stays OFF.

## Hypotheses

| ID | Hypothesis | Result |
|----|------------|--------|
| A | Cursor cannot run live AUTH_TEST (no AppDeploy / no `GRAPH_*` / Lovable 0 projects) | **CONFIRMED** |
| B | Future live `AADSTS7000215` = Entra secret VALUE mismatch, not hard-coded IDs | **PLAUSIBLE / untestable here** |
| C | `.ts` vs `.mjs` API mismatch blocks production | **REJECTED** (intentional test seam) |
| D | Hard-coded UUIDs / `process.env` identity still in drop-in | **REJECTED** (0 UUIDs) |
| E | Error-mapping bug causes false AUTH failures for 7000215 | **REJECTED** locally |

## Evidence

- Local `tgt-os-graph` appdeploy auth tests: **PASS** (mock secrets; maps 7000215 → `GRAPH_SERVICE_IDENTITY_REPAIR`)  
- Suite: **28/28 PASS**  
- Drop-in loads only `secrets.readSecret` / test secret reader for all three Graph identities  
- No production VERIFIED claim  
- Cron not touched  

## Fix

**No code fix.** Remaining wall is operator execution inside AppDeploy (Troy / iMac).

## Next

AppDeploy-authenticated operator runs: AUTH_TEST → Mail.Read → reconciliation → Command Center readback → replay creates=0 → independent verification → then consider cron.
