# AI Review Routing — Claude ↔ ChatGPT

**Effective:** 2026-09-04  
**Owner:** Tee Gates / TGT Technologies Inc.  
**Identity standard:** `master-vault/IDENTITY-STANDARD.md` (Tee Gates operational; Troy Thompson legal-only)

## Standing rule

Tee Gates **alternates** review and PM lanes between **Claude** and **ChatGPT**.

- When one model hits a usage/limit wall, route the same handoff block to the other.
- Do **not** wait on the limited model if the other is available.
- Cursor keeps producing the standard handoff block; Tee Gates pastes it into whichever reviewer is active.

## Current status (2026-09-04)

| Lane | Role | Status |
|---|---|---|
| Claude | Review / GO-NO-GO | **At limit** — skip for now |
| ChatGPT | PM + active reviewer | **Confirmed active** — reviewing TGT website + social launch |
| Cursor | Build / execute | Continues against approved handoff |
| Microsoft 365 | Permanent marketing/business record | System of record (`TGT_WEBSITE_SOCIAL_LAUNCH_HANDOFF_2026-09-04.md`) |

## ChatGPT acknowledgment (2026-09-04)

ChatGPT confirmed it is the active reviewer/PM lane and will continue from the existing M365 handoff:

`TGT BUSINESS → MARKETING → 2026 MARKETING COMMAND CENTER → 03 Content Calendar → TGT_WEBSITE_SOCIAL_LAUNCH_HANDOFF_2026-09-04.md`

### Reviewer classification for Cursor returns

Each Cursor return will be classified as one of:

- **DONE**
- **NEEDS CORRECTION**
- **BLOCKED**
- **OWNER APPROVAL REQUIRED**
- **NEXT**

### Guardrail

No new architecture replaces the existing plan unless Cursor finds a **verified production issue** that requires a change.

## How Cursor should behave

1. Still emit the normal **Copy for Claude** handoff block (repo convention).
2. While Claude is limited, paste that same block into **ChatGPT**.
3. Label active reviewer in execution notes: `Active reviewer: ChatGPT` or `Active reviewer: Claude`.
4. Write implementation results to **repo + Microsoft 365** (M365 write-back when access is available).
5. Do not invent a second competing process — same handoff, alternate destination.

## Focus areas under review (from ChatGPT)

- Homepage conversion hierarchy: signup, $280 laptop, Gates videos, actionable CTAs higher
- Mobile-first validation
- Labor Day laptop campaign visibility
- TGT Tips signup + Microsoft 365/Power Automate email path
- Gates / video placement
- Remote Support, Referral, Business IT revenue paths
- Linktree, TikTok, Facebook, Instagram, YouTube, LinkedIn rollout
- Approved Tee Gates / AI Gates photo library and next campaign (likeness: OWNER APPROVAL REQUIRED)
- GA4/conversion tracking verification
- Paid promotion planning only — no spend without Tee Gates approval
- SMS remains blocked
- Results written back to Microsoft 365 + repo

## Paste destinations

- **ChatGPT (active now):** paste the handoff block into the ChatGPT PM / review thread.
- **Claude (when limit resets):** resume normal Copy for Claude flow.
- **M365:** marketing/business permanent copies still go to the Marketing Command Center when access is available.

## Change log

- `2026-09-05` — Identity standard applied: operational owner named Tee Gates; Troy Thompson reserved for legal-only contexts. See `IDENTITY-STANDARD.md`.
- `2026-09-04` — Claude hit limit; Tee Gates directing current reviews to ChatGPT; standing alternate-between-both rule recorded.
- `2026-09-04` — ChatGPT acknowledged active reviewer role + DONE/NEEDS CORRECTION/BLOCKED/OWNER APPROVAL REQUIRED/NEXT classification scheme.
