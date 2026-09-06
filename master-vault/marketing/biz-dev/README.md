# TGT Business Development — Deal / Opportunity Ledger

**System of record (authoritative):** Microsoft 365  
`TGT BUSINESS → MARKETING → 2026 MARKETING COMMAND CENTER → Deal Ledger`  
(or nearest existing BD folder Troy designates — do not create a second CRM)

**Repo mirror (execution artifacts only):** `master-vault/marketing/biz-dev/`

## Permanent operating rules

- Every TGT BD, creator/media, free-product, NFR/software, sponsorship, review-unit, partnership, MDF/co-marketing, and related commercial opportunity goes in **this ledger**.
- Do **not** create a second CRM, duplicate Marketing Command Center, duplicate Master Vault, or competing opportunity database.
- Legal identity: **Troy Thompson, Founder & CEO, TGT Technologies Inc.**
- Public creator persona **Tee Gates** only where creator/media context is required.
- **OWNER APPROVAL REQUIRED** before accepting contracts, exclusivity, payment commitments, licensing, likeness/voice/avatar rights, paid-ad rights, sublicensing, model training, perpetual rights, or other binding legal terms.
- Dual-purpose (internal capability + sellable revenue) is a **bonus ranking weight**, not an exclusion gate.
- Prefer $0 NFR / internal-use / free-credit paths. Partner / reseller / paid / auto-renew agreements = owner gate.

## Files in this folder

| File | Purpose |
|------|---------|
| `DEAL-LEDGER.csv` | Spreadsheet-ready central ledger (all required fields) |
| `DEAL-LEDGER.md` | Human-readable index + status rollup |
| `M365-PASTE-INSTRUCTIONS.md` | Where/how to paste into SharePoint |
| `EXECUTION-RETURN-2026-09-06.md` | Cursor required return for this sprint |
| `evidence/` | Non-secret screenshots / URL captures (no passwords) |

## Security

Never store passwords, MFA codes, API keys, tokens, shipping addresses beyond owner-provided placeholders, or recovery secrets here.

## Credential delivery (secrets stay out of git)

| File | Purpose |
|------|---------|
| [`CREDENTIAL-HANDOFF-POLICY.md`](./CREDENTIAL-HANDOFF-POLICY.md) | Ranked secure ways to get passwords to Troy — never via repo |
| [`CREDENTIALS-INVENTORY.md`](./CREDENTIALS-INVENTORY.md) | Username / status metadata only — **no password values** |

Default for SaaS signups: **Troy sets the password** (Cursor stops at the gate).
