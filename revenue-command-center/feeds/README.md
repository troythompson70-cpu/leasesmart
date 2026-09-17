# Dashboard Feed — local mirror slot

**Source of truth (do not replace):**

- SharePoint site: `TEAM TGT MSP`
- Canonical path: `Shared Documents/General/TGT REVENUE COMMAND CENTER`
- Lead Intake: `…/00 Lead Intake`
- Feed: `…/10 Dashboard Feed / TGT_DASHBOARD_FEED_2026-09-10.json`
- Incoming queue: `…/10 Dashboard Feed / TGT_INCOMING_QUEUE_2026-09-15.csv`
- Schema: `2.2`

**Do not use** the malformed shell `Shared Documents/Shared Documents/...`.

This folder is a **read path for local UI development only**.

- Do **not** treat files here as a second tracker or database.
- Do **not** invent opportunity statuses.
- Place an export of the live feed here only when Troy syncs it from SharePoint.
- Acceptance scenarios live under `../fixtures/` and are labeled test fixtures.

When the live feed file is absent, the UI must not show GREEN.
