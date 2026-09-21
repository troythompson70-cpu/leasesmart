# TGT OS Graph — production AUTH_TEST gate (2026-09-21)

**Status:** `READY_FOR_PRODUCTION_AUTH_TEST`  
**Live AppDeploy:** `tgt-operating-system-wjjsv6` **v98 / `1790006649557`** (deployed ~2026-09-21 12:04 PM ET)  
**AppDeploy QA:** READY — 0 frontend / 0 backend / 0 network  
**Claude:** SUSPENDED — DO NOT USE  
**Do not:** roll back · restart UI work · re-enable `sledgehammer-production-sweep-v3` before AUTH_OK · claim VERIFIED from local 28/28

## Code-side defect — CLOSED

Production `backend/graph-auth.ts` now reads all three from protected AppDeploy secrets:

- `GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET`

Hard-coded tenant/client IDs are **gone** (Troy AppDeploy inspection).

## Still open wall

Stored Entra client-secret **VALUE** has not been proven against Microsoft’s live token endpoint after the auth-code repair. Prior cron failures (`AADSTS7000215` / HTTP 401) left `sledgehammer-production-sweep-v3` **disabled**. Local Cursor `28/28` is re-verification evidence only — **not** live token acceptance.

## Ordered gate (Independent Verifier + ChatGPT AppDeploy)

| Step | Gate | Pass criterion | Fail action |
|------|------|----------------|-------------|
| 1 | **live AUTH_TEST** | AppDeploy `runAuthTest()` / equivalent returns `AUTH_OK` (client_credentials against login.microsoftonline.com) | Stop. `OWNER_ACTION_REQUIRED: GRAPH_SERVICE_IDENTITY_REPAIR` — Troy rotates/matches Entra secret VALUE to AppDeploy secrets. Cron stays off. |
| 2 | **Graph Mail.Read** | Service identity can list/read mailbox via Graph (no send) | Stop. Consent / permission / Sites-or-Mail scope repair. Cron stays off. |
| 3 | **Inbox/Sent reconciliation** | Delta/reconcile runs without auth errors; durable identities stable | Stop. Capture proof; no cron. |
| 4 | **Command Center readback** | Visible SoT/card readback matches Graph truth | Stop. No cron. |
| 5 | **Replay creates=0** | Replay of already-captured mail creates **0** new records | Stop. Fix dedupe before cron. |
| 6 | **Re-enable Sledgehammer cron** | Only after steps 1–5 PASS | Enable `sledgehammer-production-sweep-v3` deliberately |
| 7 | **Independent verification** | Separate agent (not the implementer; not Gemini if Gemini co-designed auth) attack-tests / production readback | Record VERIFIED only after this |

## Role split

| Role | Owner |
|------|--------|
| PM / orchestrate AUTH_TEST in AppDeploy | ChatGPT |
| Architecture / residual risk | Gemini (review only) |
| Package / vault / evidence | Cursor |
| Entra secret VALUE match | Troy (never paste into chat) |
| Live AUTH_TEST + post-auth chain | Independent Verifier |

## Cursor limitation this session

- No AppDeploy MCP write / Lovable workspace shows 0 projects
- No `GRAPH_*` secrets in this Cloud Agent environment
- Cannot call Microsoft token endpoint with production client credentials from here
- Delegated Outlook MCP ≠ AppDeploy service-identity AUTH_TEST

## Evidence to vault after AUTH_TEST

Write to SharePoint `TGT BUSINESS / TGT OPERATING SYSTEM / 11 APP BUILD`:

1. AUTH_TEST result code (`AUTH_OK` or exact `OWNER_ACTION_*` / `AADSTS*` code — never the secret/token)
2. Version id `1790006649557`
3. Whether cron remains disabled or was re-enabled (and by whom)
4. Replay creates count
