# GATE 3 — TGT-EmailFeed-HEALTH — READY_FOR_VERIFY

> Built via Power Automate Management API after Azure device-code auth (Cloud browser blocked by GoDaddy bot check).  
> **Do not touch:** `TGT-EmailFeed-IN`, `TGT-EmailFeed-OUT`, list `TGT Email Feed` data/columns/views, Gate 2 Command Center view.

**Date:** 2026-10-02  
**Flow name:** `TGT-EmailFeed-HEALTH`  
**Flow id:** `2cec223d-e9db-4c95-a145-0d1a1f057b08`  
**Flow state:** **ON** (`Started`)  
**URL:** https://make.powerautomate.com/environments/Default-a1bd1d54-1b1f-4e0c-b575-f2938aee86a8/flows/2cec223d-e9db-4c95-a145-0d1a1f057b08?v3=true  
**Environment:** `Default-a1bd1d54-1b1f-4e0c-b575-f2938aee86a8`

## Build

| Step | Config |
|---|---|
| Trigger | Recurrence daily **08:00** `Eastern Standard Time` |
| Get items | Site `…/personal/tgates_tgttechnologies_com`, list `TGT Email Feed` (`b05dfec7-92b8-41ce-a10c-86c9da41aef7`), filter `Created ge '@{addHours(utcNow(),-24)}'`, top **1**, read-only |
| Condition | `length(value) == 0` → ALARM |
| ALARM email | To `tgates@tgttechnologies.com`, subject `TGT ALERT: Email feed stopped — no rows in 24h`, body one line + TGT-EmailFeed-IN link |
| ALARM Teams | **BLOCKED** (no existing Teams connection in environment; one attempt; email-only per stop rule; owner = Troy) |
| Failure notifications | `flowFailureAlertSubscribed: true` (owner) |

## Tests

| Test | Result | Proof |
|---|---|---|
| A — ALARM fires | **PASS** | Run `08584107033848592077386604725CU06` — Get_items OK, Condition Succeeded, Send_an_email Succeeded. Inbox subject `[TEST] TGT ALERT: Email feed stopped — no rows in 24h` at 2026-10-02T01:11:45Z. |
| B — stays silent | **PASS** | Run `08584107032941141172684211041CU10` — Get_items OK, Condition Succeeded, Send_an_email **Skipped**. Real 24h filter + real subject restored; flow left **ON**. |

## Teams unblock (Troy, optional)

In Power Automate → `TGT-EmailFeed-HEALTH` → add **Post message in a chat** (Flow bot) to yourself, save. Cursor already left email alarm ON.

## Artifacts

- `/opt/cursor/artifacts/gate3-proof.json`
- `/opt/cursor/artifacts/gate3-test-a-run.json` / `gate3-test-a-actions.json`
- `/opt/cursor/artifacts/gate3-test-b-run.json` / `gate3-test-b-actions.json`

## Next action owner

**Claude / Troy** — verify PR + flow ON; optional Teams step for Troy.
