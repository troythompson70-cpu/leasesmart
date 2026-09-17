# TGT OS — Outlook ingestion audit (vaulted 2026-09-15)

**Project:** TGT Operating System (AppDeploy) + LeaseSmart vault record  
**Build ID:** 20260915-tgt-os-outlook-audit-vault  
**Source:** Production audit results pasted into Cursor cloud agent `Outlook ingestion audit fixes`  
**Repo note:** Receiving-side TGT OS application code lives on AppDeploy, **not** in `leasesmart`. This file vaults the audit for Master Vault / Claude review and records mailbox-side live-verification evidence.

## Verdict

TGT OS receiving side is reported **FIXED and deployed** (ingestion key, body parsing, realtime owner scope, drawer rebind, reconciliation backfill-only, transmission chronology, mobile card body display, sync banner cleanup, regression coverage, deploy QA READY).

**Not yet proven end-to-end:** Microsoft 365 Power Automate flow `TGT - Email Intake` actually POSTing every new Inbox/Sent message with the required key/header.

**Historical limitation:** older cards that never stored bodies will stay empty until an Outlook backfill.

## Audit checklist (as reported)

| # | Item | Status |
|---|---|---|
| 1 | `OUTLOOK_INGEST_KEY` missing → now in app secret store | FIXED |
| 2 | `bodyPreview` overriding full body → body first, preview fallback | FIXED |
| 3 | Outlook HTML/object body parsing + safe HTML strip | FIXED |
| 4 | Realtime broadcast missing TGT owner ID | FIXED |
| 5 | Open drawer stale after refresh/realtime | FIXED |
| 6 | NinjaOne reconciliation overwriting newer Outlook state → backfill-only | FIXED |
| 7 | Last Transmission = newest of Sent vs Received | FIXED |
| 8 | Blank Last Transmission → Updated / Last Activity fallback | FIXED |
| 9 | Mobile cards show LAST SENT BY TGT / LAST RECEIVED + message text | FIXED |
| 10 | Mobile UI readability enlargements | FIXED |
| 11 | Sync banner: neutral Last sync · Outlook · Refresh | FIXED |
| 12 | Mobile production regression coverage expanded | FIXED |
| 13 | Deployment QA READY — 0 FE / 0 BE / 0 network errors | PASSED |
| 14 | M365 flow delivery POSTing to ingest endpoint | **NEEDS LIVE VERIFY** |
| 15 | Historical missing bodies | **BACKFILL REQUIRED** (optional) |

## Cursor mailbox evidence (2026-09-15) — item 14 helper

Connected Graph account: `tgates@tgttechnologies.com`.

### Strong live e2e candidates (already in Inbox / Sent today)

Use one of these as the definitive TGT OS card check — do **not** fabricate probe mail to production intake.

1. **Inbox 2026-09-15 15:59 UTC** — `Re: [EXTERNAL] RE: Troy | NinjaOne Overview — Move Meeting to Next Week` from `Max.Farrell@ninjaone.com` (unread when checked).  
   Expect: NinjaOne / Max Farrell card updates Received, shows body/time slots text, Last Transmission advances, open drawer rebinds if already open.
2. **Inbox 2026-09-15 14:53 UTC** — `Re: Declined: usecure Demo` from `dominic@usecure.io`.  
3. **Inbox 2026-09-15 13:11 UTC** — `Re: [Duo MSP] Re: TGT Technologies Inc. — Secure MSP Center + NFR License Inquiry` from `jmillika@cisco.com`.

### Adjacent Power Automate dormancy signal (different flow)

- **2026-08-31** email `Alert! Your flow is not running` from `PowerAutomateNoReply@microsoft.com`.  
- Named flow: **LeaseSmart Agent Intake Router** (not necessarily `TGT - Email Intake`).  
- Message claimed no runs for 90 days and warned of auto-off in 30 days.  
- Treat as a reminder to open Power Automate and confirm **`TGT - Email Intake`** is **On**, has recent successful runs, and posts to the current TGT OS ingest URL with the configured key — do not assume the LeaseSmart router alert equals TGT Email Intake failure.

## Live verification protocol (Troy)

1. Open TGT Operating System on phone/desktop (AppDeploy production).  
2. Confirm Last sync · Outlook line looks healthy after a manual Refresh.  
3. Open (or keep open) the card matching Max Farrell / NinjaOne if present.  
4. Confirm card shows LAST RECEIVED, exact time (~15:59 UTC / local), and message text from the time-slot reply.  
5. Optionally send one real business reply from TGT mailbox and confirm LAST SENT BY TGT updates without closing the drawer.  
6. In Power Automate: open `TGT - Email Intake` → run history for today’s Max Farrell message → HTTP action success + correct headers (no secrets in vault).

## What this leasesmart agent could / could not do

| Action | Result |
|---|---|
| Vault audit + Claude handoff | Done (this report) |
| Open AppDeploy TGT OS UI | **Blocked** — no production AppDeploy URL in leasesmart; Lovable MCP `needsAuth`; Browser-use MCP unavailable |
| Re-implement AppDeploy fixes here | N/A — code not in this repo |
| Live Exchange probe POSTs | **Banned** (`.cursor/rules/no-live-exchange-probes.mdc`) |
| Parked TGT OS agent/blueprint sprint | **Not started** (user rule) |

## Secrets

No API keys, ingest keys, or tokens recorded in this vault file.
