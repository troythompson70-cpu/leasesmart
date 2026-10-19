# READBACK PROOF — Cursor ROUTE → Gemini (AIWO-008/009)

- agent: Cursor
- checkpoint_id: CP-AIWO008009-ROUTE-GEMINI-20260917_141656
- readback_at: 2026-09-17T14:20:30Z
- m365_account: tgates@tgttechnologies.com

## Files read back (byte-identical to local vault)

| File | ItemId | Size | SHA256 prefix | BYTE_MATCH |
|---|---|---|---|---|
| AGENT EVIDENCE/AIWO-008-009_Cursor_ROUTE_GEMINI_20260917_141656.md | 01BHMVN4ZQ3Y2WHKZH5NEJEOCUV4TA6DLM | 4503 | b50292651b463b1b | True |
| AGENT EVIDENCE/AIWO-008_READY_FOR_AUDIT_Gemini.md | 01BHMVN45GKN345DFRZFFZBBE7G6ELRVF2 | 2198 | e83675d106b5b1e2 | True |

## Content markers confirmed in remote readback

- ROUTE: `I AM=Cursor`, `READY_FOR_AUDIT`, `NEXT OWNER`, `GEMINI`, `1012854`
- GEMINI packet: `READY_FOR_AUDIT`, `GEMINI`, `1012854`

## Also written (metadata confirmed; not re-hashed this pass)

- `10 AUDIT & ACTIVITY LOG/AIWO-008_READY_FOR_AUDIT_Gemini.md` (id 01BHMVN46OZU5MUBHA6BB3ZUMZ7CIINIZG)
- `10 AUDIT & ACTIVITY LOG/COPILOT_ENSURE_GEMINI_AUDITOR_IDENTITY_20260917.md` (id 01BHMVN47N3573B4M725ELGVWNAUXG7VL3)

## Access note

OneDrive MCP `get_drive_item` does not return file body; content readback used `@microsoft.graph.downloadUrl` returned by `create_or_update_file`. Queue CSV was not overwritten (content unread via MCP list-only).

## Status

Cursor routing write **READBACK_OK**. No self-VERIFY. Phase remains **READY_FOR_AUDIT / PENDING_AUDIT**.
