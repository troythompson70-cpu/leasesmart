# SUPERSEDED — 2026-10-01

**Do not execute this AppDeploy HTTP handoff.**

Gate 1 was redefined as **Microsoft-only**:

Outlook → TGT-EmailFeed-IN → SharePoint list `TGT Email Feed` (row within ~2 minutes).

AppDeploy ingest / Graph reconcile / Sledgehammer are **out of Gate 1**.

See instead:

- `TGT_GATE1_MICROSOFT_ONLY_2026-10-01.md`
- Troy one-check: reply `rows there` or `rows missing` on the SharePoint list (newest).
