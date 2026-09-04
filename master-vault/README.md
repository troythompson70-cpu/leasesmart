# LeaseSmart Master Vault

Upload these files to **Microsoft 365 Master Vault** for TGT record-keeping.

## AI review routing

Troy **alternates between Claude and ChatGPT**. When one hits a limit, route the same handoff to the other.

- Standing note: [`ai-comms/AI-REVIEW-ROUTING.md`](ai-comms/AI-REVIEW-ROUTING.md)
- **Current (2026-09-04):** Claude at limit → send reviews to **ChatGPT** until Claude resets.

## Files

| File | Purpose |
|------|---------|
| `ai-comms/AI-REVIEW-ROUTING.md` | Claude ↔ ChatGPT alternate review routing |
| `LeaseSmart-Sprint-Master-Log.md` | Running log of sprint commands, Cursor reports, Claude reviews, GO/NO-GO |
| `morning/MORNING-REVIEW-latest.md` | Troy's 2-minute morning checklist (regenerated overnight or on demand) |
| `morning/HANDOFF-latest.html` | One-click **Copy for Claude** button for latest handoff block (same text OK for ChatGPT when Claude is limited) |

## Commands (from repo root)

```bash
# Log a sprint command
node scripts/sprint-log.mjs command "Sprint B2 — build logger" --sprint B2

# Log a Cursor report
node scripts/sprint-log.mjs cursor-report "Built morning checklist generator." --sprint B2

# Log Claude review
node scripts/sprint-log.mjs claude-review "Schema looks good. No secrets in diff." --verdict GO --sprint C1

# Log GO/NO-GO
node scripts/sprint-log.mjs go-no-go "Approved for commit when Troy says commit." --verdict GO --sprint A4

# Generate morning checklist (runs A6 + C1 tests)
node scripts/morning-checklist.mjs
```

## Security

- API keys, passwords, tokens, and service role keys are **automatically redacted** before writing.
- Never paste real secrets into log commands — the sanitizer is a safety net, not a guarantee.
