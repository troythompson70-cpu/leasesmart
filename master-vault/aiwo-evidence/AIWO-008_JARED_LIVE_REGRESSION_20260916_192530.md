# Jared Millikan Live Regression Evidence — AIWO-008

- written_at: 2026-09-16T19:25:30Z
- agent: Cursor
- HARD HOLD: NO REPLY SENT TO JARED. Outlook was read-only via Graph list_mail_messages.

## Live Outlook message (Layer 0 discovery)

| Field | Value |
|-------|-------|
| From | Jared Millikan (jmillika) \<jmillika@cisco.com\> |
| To | tgates@tgttechnologies.com |
| Subject | Re: [Duo MSP] Re: TGT Technologies Inc. — Secure MSP Center + NFR License Inquiry |
| receivedDateTime | 2026-09-16T18:21:50Z |
| isRead | false (at discovery) |
| conversationId | AAQkADU4ZWEzOTBmLTY3NzItNGMzOC05ZDRhLWU2MmQ0OGYwNWI0YQAQAChezebRSQdAhDY2cjgSBnM= |
| message id | AAMkADU4ZWEzOTBmLTY3NzItNGMzOC05ZDRhLWU2MmQ0OGYwNWI0YQBGAAAAAABM-p-pNO4PQqCbYv78AJTcBwB2LmLWh7LLR6NU-Qgn6UINAAAAAAEMAAB2LmLWh7LLR6NU-Qgn6UINAAVimj-yAAA= |
| bodyPreview (start) | Hey Troy, Would love to get this taken care of for you sooner rather than later so you can use! |
| webLink | outlook.office365.com OWA ReadMessageItem for the exact ItemID above |

## Three-layer proof (automated via real message payload)

Command: `node revenue-command-center/tests/aiwo008_regression.mjs`
Exit code: **0** (26/26 including JARED_E2E)

| Layer | Proof | Result |
|-------|-------|--------|
| 1 Canonical write | `processDiscovery` / `runMailboxBackfill` updates SW-DUO-CISCO with source_message_id + message_preview + web_link; no new duplicate opportunity | PASS |
| 2 Command Center ingest | NEW REPLIES item keyed by source_message_id, ack_status=UNACKNOWLEDGED, company Cisco / cisco.com | PASS |
| 3 Independent readback | `recentEmailOf(SW-DUO-CISCO)` returns preview containing “sooner rather than later”, direction INCOMING, Open Email webLink to Outlook | PASS |

JARED_E2E detail:
`{"layer1_canonical":true,"layer2_cc_ingest":true,"layer3_readback":true,"imported":1,"matched":1,"failures":[]}`

## Company intelligence

- jmillika@cisco.com → domain cisco.com → company Cisco
- upsertCompanyRecord keeps a single company row; second cisco.com contact does not create a duplicate company (CO1–CO3 PASS)

## Not claimed

- Cursor did **not** self-VERIFY.
- Cursor did **not** send/draft-send/forward/acknowledge anything to Jared.
