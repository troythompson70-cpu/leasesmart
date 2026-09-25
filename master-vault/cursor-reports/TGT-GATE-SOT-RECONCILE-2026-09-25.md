# TGT GATE SoT reconciliation — 2026-09-25

**Status:** Claude Gate 1 evidence accepted as **operational SoT** pending Troy independent acceptance.  
**Cursor action:** Do **not** re-diagnose Gate 1. Resume **Gate 2 A1** (SAFE mode condition save).

## Gate 1 — Source of Truth

| Field | Value |
|---|---|
| Evidence file | `TGT BUSINESS/TGT OPERATING SYSTEM/10 AUDIT & ACTIVITY LOG/GATE1_EVIDENCE_2026-09-24.md` |
| Recorded by | Claude |
| Result | **GATE 1 PASS** (Claude disclosed: not independent verification) |
| Root defect fixed | Mode Choice object vs text `"RUN"` — fixed with `?['Mode']?['Value']` on IN + OUT |
| Tests | FIX / FIX3 / PAUSE / RESUME + Heartbeat — PASS with Email Feed + Heartbeat list item IDs |
| Troy acceptance | **PENDING** (independent) |
| Cursor stance | Treat as SoT; no Gate 1 re-open unless Troy finds regression |

### Prior Cursor vault conflict (resolved)

`TGT-GATE1-OUTLOOK-INGEST-DIAGNOSIS-2026-09-24.md` and morning review said Gate 1 NOT COMPLETE because this Cursor agent had not ingested Claude’s overnight evidence. That conflict is **closed in favor of Claude’s Gate 1 evidence file**.

## Gate 2 — current

| Field | Value |
|---|---|
| Evidence file | `…/GATE2_EVIDENCE_2026-09-25.md` |
| Flow | `TGT-EmailFeed-IN` (`bafc73d1-854d-4543-b6a2-b3a2240988e7`) |
| A1 SAFE-only stop | Claude **FAILED** (RHS stuck `"RUN"`). Cursor resume **BLOCKED** at M365 password; Option B patch script ready (`scripts/gate2-a1-patch-safe-rhs.mjs`) |
| A2–D | Not started |
| End state | Flows not saved by Cursor; Mode last known RUN |
| Cursor next | Authenticated PA session or export zip → Option B `--write` → Import update → Code-view `"SAFE"` |

## Rules honored

- No Graph credential rotation  
- No Sledgehammer re-enable for Gate 1 retry  
- No Gate 1 re-diagnosis from scratch  
- Troy remains acceptance authority for Gate 1 freeze language
