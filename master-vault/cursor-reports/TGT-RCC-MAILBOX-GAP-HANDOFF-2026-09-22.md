# TGT RCC HANDOFF — MAILBOX GAP / Graph Reconciliation (2026-09-22)

**Accepted SoT from Troy handoff.** Diagnosis only — no LeaseSmart / Command Center UI code change.

--- TGT RCC HANDOFF START ---
Project: TGT Operating System / Revenue Command Center (RCC)
System: TGT Command Center
Sprint: MAILBOX GAP / Microsoft Graph Reconciliation Repair
Environment: Production — AppDeploy
Build ID: 1790008022504 (NOT VERIFIED)
Status: BLOCKED — GRAPH AUTHENTICATION / SERVICE IDENTITY
Code Status: NO CODE CHANGE REQUIRED FROM CURRENT DIAGNOSIS

## CURRENT CONDITION

The TGT Command Center itself is NOT down.
The production UI loads successfully and existing stored records/cards are available. However, the Command Center is NOT Graph-current because Microsoft Graph reconciliation is failing.

## CAUSAL CHAIN

1. User selects "Reconcile Outlook + Refresh."
2. TGT OS POSTs to: `/api/integrations/graph/reconcile`
3. Reconciliation attempts Microsoft Graph access.
4. Graph reconciliation fails.
5. UI subsequently reloads: `/api/records`
6. Previously stored records/cards remain visible.
7. Command Center correctly displays: MAILBOX GAP
8. Therefore, visible records cannot be considered current until Graph reconciliation succeeds.

## VERIFIED / OBSERVED

- Command Center frontend: AVAILABLE
- Existing stored records: AVAILABLE
- User session/login: WORKING
- Records reload: WORKING
- Reconcile API route: EXISTS
- Unauthenticated reconcile POST: 401
- MAILBOX GAP protection: WORKING AS DESIGNED
- Microsoft Graph reconciliation: FAILING
- Graph service identity: NOT VERIFIED
- Production AUTH_TEST: NOT YET VERIFIED AS AUTH_OK
- Mailbox-current status: FAIL
- Cron/automatic mailbox sweep: OFF
- Sledgehammer mailbox reconciliation: BLOCKED BY GRAPH AUTH

## PRIMARY OPEN GATE

Microsoft Graph service identity must pass production AUTH_TEST.

Required sequence:

Entra App Registration
→ verify correct Tenant ID
→ verify correct Client ID
→ obtain active Client Secret VALUE
→ AppDeploy GRAPH_CLIENT_SECRET
→ run AUTH_TEST / runAuthTest()
→ require AUTH_OK
→ manually run Reconcile Outlook + Refresh
→ require successful Graph reconciliation
→ require UPDATED/current mailbox state
→ perform Outlook-vs-Command-Center gap readback
→ verify cards/evidence
→ only then consider re-enabling cron

## IF AUTH_TEST RETURNS AADSTS7000215

Treat as GRAPH_SERVICE_IDENTITY_REPAIR.

Verify that AppDeploy contains the Entra CLIENT SECRET VALUE — not the Secret ID — and that the secret belongs to the same Entra application represented by the configured Client ID and Tenant ID.

Never place secret values in ChatGPT, Claude, Cursor, tickets, screenshots, logs, or handoff documents.

## DO NOT CHANGE

- LeaseSmart
- Command Center UI
- Card rendering
- Filters/sorting
- Reconciliation architecture
- Existing verified gates
- Sledgehammer architecture

Do not create a workaround that bypasses MAILBOX GAP.

## CRON POLICY

Cron remains OFF until:

AUTH_OK
→ successful manual reconciliation
→ mailbox gap cleared
→ Outlook/Command Center readback passes
→ independent verification passes

## PROJECT OWNERSHIP CORRECTION

This incident is NOT a LeaseSmart issue.

Correct project: TGT Operating System / Revenue Command Center (RCC)

LeaseSmart is outside the scope of this incident and must remain isolated from this repair.

## NEXT ACCEPTANCE GATE

PASS requires:

AUTH_OK
+ successful Graph reconciliation
+ UPDATED/current mailbox state
+ Outlook → Command Center gap audit PASS
+ record/card readback PASS

Until those conditions are met:

STATUS = NOT VERIFIED / NOT GRAPH-CURRENT
--- TGT RCC HANDOFF END ---

## Cursor package note

- Live app URL: `https://tgt-operating-system-wjjsv6.v2.appdeploy.ai/`
- Wrong ChatGPT deep link (`api-v2.appdeploy.ai/app/...`) returns 404 — not the live shell.
- Claude: SUSPENDED — DO NOT USE for execution.
- No VERIFIED claim from this vault write.
