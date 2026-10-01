# TGT GATE 1 — Microsoft-only redefinition — 2026-10-01

**Recorded by:** Cursor  
**Verdict:** **SUPERSEDED by COMPLETE** — see `TGT_GATE1_COMPLETE_MICROSOFT_ONLY_2026-10-01.md`  
**Final:** GATE 1 — COMPLETE — 100% VERIFIED — NO FURTHER MOVEMENT (`rows there` + E2E-1/2 PASS)  
**AppDeploy:** **OUT of Gate 1** (receiver / Graph reconcile / Sledgehammer not in scope)  
**Gate 2:** Unblocked for explicit start; not auto-started

## New Gate 1 definition (authoritative)

```
Outlook Inbox
  → Power Automate TGT-EmailFeed-IN (already built)
  → SharePoint list "TGT Email Feed" row within ~2 minutes
  → View in Microsoft Lists / Teams / Excel (same list)
```

Nothing is sent to AppDeploy. SharePoint list **is** the Command Center data for this gate.

**PASS:** A new qualifying email appears as a new list row within about 2 minutes. Prove with Email #1 and Email #2 (independent).  
**Then:** GATE 1 — COMPLETE — 100% VERIFIED — NO FURTHER MOVEMENT. Freeze. Only then Gate 2.

## Supersedes

- Prior Cursor status `TGT_GATE1_STATUS_2026-09-30.md` (AppDeploy ingest handoff path) — **retired for Gate 1**.
- `OWNER_ACTION_GATE1_HTTP_HANDOFF_2026-09-30.md` — **do not execute**.
- Claude CEO plan Graph reconcile / Sledgehammer re-enable — **stay off**.

## One check (Troy — ~2 minutes)

List:  
https://netorgft7859571-my.sharepoint.com/personal/tgates_tgttechnologies_com/Lists/TGT%20Email%20Feed/AllItems.aspx  

Sort newest. Reply exactly: **`rows there`** or **`rows missing`**.

### Junk-filter caveat (avoid false “missing”)

TGT-EmailFeed-IN drops senders whose From contains: `noreply`, `no-reply`, `donotreply`, `do-not-reply`, `newsletter`, `marketing`, `mailer-daemon`, `postmaster`, `notifications@`.

| Today’s mail | From | Expected vs junk filter |
|---|---|---|
| MSP360 | `no-reply@msp360.com` | **Excluded by design** |
| Breeze | `noreply@2breeze.app` | **Excluded by design** |
| TD Credit | `noreply@emails.creditscore.td.com` | **Excluded by design** |
| Guardz / HP Instant Ink / DriveWealth / Google | noreply variants | **Excluded by design** |
| Action1 | `account@na-2.action1.com` | Should write if flow healthy |
| Wells Fargo alerts | `alerts@notify.wellsfargo.com` | Should write if flow healthy |
| Experian | `support@e.usa.experian.com` | Should write if flow healthy |
| Self / WorkMarket ADP accept | non-noreply | Should write if flow healthy |

If only noreply mail is missing but Action1 / Wells / Experian / ADP accept rows exist for 9/30–10/1 → say **`rows there`**.  
If those PASS-filter subjects are absent → **`rows missing`**.

## Cursor capability this turn

| Action | Result |
|---|---|
| Adopt Microsoft-only Gate 1 definition | Done (this file) |
| Open SharePoint list in browser | **AUTH_REQUIRED** (login.microsoftonline.com; screenshot artifact) |
| Graph list items API | No Graph app secrets in this VM; Onedrive MCP is drive-only |
| Edit Power Automate | No PA tool |
| Graph reconcile / Sledgehammer | Left off |

## Condition risk (flagged)

Screenshots of TGT-EmailFeed-IN show runs ending after Condition in 1–2s. That can mean:

1. Junk filter false branch (no Create item) — expected for noreply senders  
2. Mode ≠ RUN (PAUSE / Choice Value bug) — Create item skipped while run still Succeeded  
3. Duplicate MessageId already on list — Create item skipped  

One list check settles whether Create item is happening for PASS-filter mail.

## Ready directives (execute only after Troy replies)

### If `rows there`

1. Record AppDeploy **retired from Gate 1** (no ingest dependency). Leave Sledgehammer disabled. Leave Graph reconcile unused.  
2. Send test Email #1 to `tgates@tgttechnologies.com` subject `GATE1-MS-E2E-1` (body: Microsoft-only Gate 1 test 1).  
3. Within 2 minutes: confirm new SharePoint row (Title, Direction IN, EmailDate, FromAddress). Screenshot.  
4. Send Email #2 subject `GATE1-MS-E2E-2`. Confirm second row. Screenshot.  
5. Report **GATE 1 PASS** with row Ids + screenshots. Freeze. Do not start Gate 2 until ordered.

### If `rows missing`

1. Do **not** send e2e tests yet.  
2. Owner/PA-capable session: open latest TGT-EmailFeed-IN Succeeded run; expand Condition(s).  
3. Likely fix (from 2026-09-24 evidence): Mode check must use  
   `first(outputs('Get_items_2')?['body/value'])?['Mode']?['Value']` equals `RUN`  
   (not the Choice object). Confirm System Mode list item is RUN.  
4. Save flow → confirm Create item runs on a PASS-filter message.  
5. Then run the same Email #1 / #2 proof as above.

## Artifacts

- `/opt/cursor/artifacts/gate1-sharepoint-list-auth-required.webp` — list URL hit Microsoft sign-in  
- Prior PA screenshots still valid for Condition-stop observation only
