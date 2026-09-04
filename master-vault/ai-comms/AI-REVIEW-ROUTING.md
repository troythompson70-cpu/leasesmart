# AI Review Routing — Claude ↔ ChatGPT

**Effective:** 2026-09-04  
**Owner:** Troy / TGT Technologies Inc.

## Standing rule

Troy **alternates** review and PM lanes between **Claude** and **ChatGPT**.

- When one model hits a usage/limit wall, route the same handoff block to the other.
- Do **not** wait on the limited model if the other is available.
- Cursor keeps producing the standard handoff block; Troy pastes it into whichever reviewer is active.

## Current status (2026-09-04)

| Lane | Role | Status |
|---|---|---|
| Claude | Review / GO-NO-GO | **At limit** — skip for now |
| ChatGPT | PM + interim review | **Active** — send current work here |
| Cursor | Build / execute | Continues as usual |
| Microsoft 365 | Permanent marketing/business record | System of record where applicable |

## How Cursor should behave

1. Still emit the normal **Copy for Claude** handoff block (repo convention).
2. Also treat that same block as valid paste material for **ChatGPT** while Claude is limited.
3. Label active reviewer in execution notes: `Active reviewer: ChatGPT` or `Active reviewer: Claude`.
4. Do not invent a second competing process — same handoff, alternate destination.

## Paste destinations

- **ChatGPT (active now):** paste the handoff block into the ChatGPT PM / review thread.
- **Claude (when limit resets):** resume normal Copy for Claude flow.
- **M365:** marketing/business permanent copies still go to the Marketing Command Center when access is available.

## Change log

- `2026-09-04` — Claude hit limit; Troy directing current reviews to ChatGPT; standing alternate-between-both rule recorded.
