# Deployment candidate checklist — tgt-os-graph

**Status:** `DEPLOYMENT_BLOCKED_CREDIT_RESET` — candidate ready; no deployment attempted  
**Safe production:** `1789734343421` / v44 — **not replaced**

## Local / pre-deploy gates (executed)

| Gate | Result |
|------|--------|
| AUTH_TEST (module + missing-secret codes) | PASS (unit) |
| IMMUTABLE_ID_TEST | PASS |
| 429_RETRY_TEST / 503_RETRY_TEST | PASS |
| OUTLOOK_DELTA_TEST | PASS |
| LIFECYCLE_TEST + notification lifecycle | PASS |
| NOTIFICATION_VALIDATION | PASS |
| SHAREPOINT_ID_TEST / SHAREPOINT_DELTA_TEST | PASS |
| ATOMIC_CAPTURE / DEDUPE / REPLAY / ORPHAN / RESTART / VISIBLE_READBACK | PASS |
| CISCO_HARD_HOLD_TEST | PASS |
| tgt-os-graph suite | **23/23 PASS** |
| RCC AIWO-008 regression | **26/26 PASS** |
| Orchestrator unittest | **19/19 PASS** |
| Prod static appVersion | **1789734343421** |
| AppDeploy API | **402 APP_TEMPORARILY_UNAVAILABLE** |
| Secret scan (high-risk patterns) | clean (test fixtures only) |

## Still required before production AUTH_TEST

Owner AppDeploy secrets (do not paste into chat):

- `GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET`

Entra: **TGT Command Center Production** — `Mail.Read` + `Sites.ReadWrite.All` only  
https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

## Not done (blocked)

- AppDeploy transplant of `tgt-os-graph/` (source not in leasesmart)
- Production deploy
- Production acceptance suite / VERIFIED
