# Dashboard Feed — local mirror slot

**Source of truth (do not replace):**

- SharePoint site: `TEAM TGT MSP`
- Path: `Shared Documents/General/TGT REVENUE COMMAND CENTER`
- Feed: `10 Dashboard Feed / TGT_DASHBOARD_FEED_2026-09-10.json`
- Schema: `2.1`

This folder is a **read path for local UI development only**.

- Do **not** treat files here as a second tracker or database.
- Do **not** invent opportunity statuses.
- Place an export of the live feed here only when Troy syncs it from SharePoint.
- Acceptance scenarios live under `../fixtures/` and are labeled test fixtures.

When the live feed file is absent, the UI must not show GREEN.
