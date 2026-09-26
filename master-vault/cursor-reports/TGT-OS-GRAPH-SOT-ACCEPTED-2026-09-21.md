# Accepted source of truth — MAILBOX GAP / Graph AUTH_TEST (2026-09-22)

Troy accepted handoff `TGT-RCC-MAILBOX-GAP-HANDOFF-2026-09-22.md` as current SoT.

- **Project:** TGT Operating System / Revenue Command Center (RCC) — **not** LeaseSmart.
- **Build:** AppDeploy `tgt-operating-system-wjjsv6` / `1790008022504` — **NOT VERIFIED**.
- **UI:** Command Center is **up**; stored cards load; session works.
- **Mailbox-current:** **FAIL** — MAILBOX GAP after Reconcile Outlook + Refresh (Graph reconcile fails; `/api/records` reload still works).
- **Code:** **No LeaseSmart / CC UI code change** from this diagnosis. Do not bypass MAILBOX GAP.
- **Blocker:** Microsoft Graph service identity — production AUTH_TEST not yet `AUTH_OK`.
- **Status:** `BLOCKED — GRAPH AUTHENTICATION / SERVICE IDENTITY` (continues `AWAITING_APPDEPLOY_AUTH_TEST_EXECUTION`).
- **Cron:** remains **OFF** until AUTH_OK → successful manual reconcile → gap cleared → Outlook/CC readback → independent verification.
- **If AADSTS7000215:** `GRAPH_SERVICE_IDENTITY_REPAIR` — AppDeploy must hold Entra client secret **VALUE** (not Secret ID) for the configured Client ID + Tenant ID. Never paste secrets into chat/logs.

No VERIFIED or Graph-current claim is made.

Claude: SUSPENDED — DO NOT USE.
