# Credential Handoff Policy — TGT Business Development Accounts

**Owner:** Troy Thompson, Founder & CEO, TGT Technologies Inc.  
**Effective:** 2026-09-06  
**Scope:** Every account Cursor creates or prepares for TGT BD / creator / NFR / partner work.

## Absolute rules

1. **Never** store passwords, MFA seeds, recovery codes, API keys, session tokens, or OAuth refresh tokens in:
   - this Git repository
   - `master-vault/`
   - PR descriptions / commit messages
   - Deal Ledger CSV/MD
   - evidence screenshots that show filled password fields
   - shared Drive folders that sync into git
2. **Never** invent a password and leave it only in agent memory — if Cursor must set a password, Troy must receive it on an approved secure channel **before** the session ends.
3. Usernames / login emails (non-secret) **may** appear in the Deal Ledger.
4. Password **status** (NOT_SET / OWNER_SET / DELIVERED_OUT_OF_BAND) may appear in the ledger — **never** the password value.
5. If Cursor cannot deliver a password securely, Cursor **must stop** at the password gate and have Troy create the password himself (preferred for Lovable today).

---

## Audit — best ways to get passwords to Troy

Ranked for TGT (security → practicality). Use the highest option that is actually connected.

### Rank 1 — Preferred: Troy creates the password (owner-set)

**When:** Signup requires password + CAPTCHA/MFA (Lovable today).

**How:**
1. Cursor fills email / business fields only.
2. Cursor stops at password field.
3. Troy creates password in his password manager.
4. Troy completes CAPTCHA / email verify / MFA.

**Pros:** No agent-held secret; no delivery risk; Troy already owns the vault.  
**Cons:** Troy must be available for the gate.  
**Verdict:** **Best default for consumer/SaaS signups.**

### Rank 2 — Best when Cursor must generate a password: 1Password shared vault / item share

**When:** Form requires Cursor to submit a password in-session.

**How:**
1. Cursor generates a strong unique password in memory only.
2. Cursor creates a **1Password** item in a Troy-owned vault (or Shared vault) titled e.g. `Lovable — tgates@tgttechnologies.com`.
3. Cursor sets username/email + password + URL + one-time note.
4. Cursor tells Troy: “Item saved in 1Password vault X” — **not** the password text in chat if avoidable.
5. Optional: 1Password **Share** / ephemeral link with expiry for one-time view.

**Current environment status (2026-09-06):** 1Password MCP = **broken / unavailable**. 1Password CLI (`op`) = **not installed**.  
**Owner action to enable:** reconnect 1Password MCP (or install `op` + service account) in Cursor Cloud environment.

**Verdict:** **Best automated delivery — blocked until 1Password is connected.**

### Rank 3 — Encrypted / private email to Troy only

**When:** 1Password unavailable; password was necessarily created.

**How:**
1. Email **only** Troy’s controlled inbox (prefer `troy@…` / `tgates@tgttechnologies.com` on M365 — not a public CC).
2. Subject: `TGT CREDENTIAL HANDOFF — [Service] — [date] — DELETE AFTER SAVE`
3. Body: service URL, username/email, password, MFA status, “save to 1Password then delete this email.”
4. Troy saves to 1Password immediately and deletes the email.
5. Cursor records in ledger: `Password: DELIVERED_VIA_EMAIL_YYYY-MM-DD` (no value).

**Current environment status:** Gmail MCP = **needsAuth**. Outlook/M365 send = **not connected**.  
**Owner action:** Authenticate Gmail MCP and/or grant Outlook send for `tgates@tgttechnologies.com`.

**Verdict:** Acceptable interim — **not available this session.**

### Rank 4 — Live owner channel (iMessage / Signal / phone call) — one-time

**When:** Email and 1Password both unavailable; Troy is online.

**How:** Troy joins the session; Cursor displays password once in the live UI for Troy to copy into 1Password; Cursor does not write it to repo/PR/vault files.

**Verdict:** Acceptable emergency path only.

### Rank 5 — NEVER use

| Method | Why forbidden |
|--------|----------------|
| Commit / PR / issue comment | Permanent public/private git history |
| `master-vault/` markdown “password list” | Already had a prior password-exposure incident; vault mirrors sync widely |
| Evidence screenshots with password visible | End up in git + M365 |
| Slack/Discord public channels | Retention + broad access |
| Shared Google Doc / Sheet of passwords | Spreads; hard to rotate |
| Reusing one TGT password across vendors | Credential stuffing risk |

---

## Username / identity conventions (non-secret — OK to log)

| Context | Use |
|---------|-----|
| Business / NFR / partner | Troy Thompson, Founder/CEO, TGT Technologies Inc. |
| Creator / media persona | Tee Gates |
| Primary BD email | `tgates@tgttechnologies.com` |
| Do not invent | Secondary emails, phone, shipping address, follower counts |

---

## Required Cursor behavior per account

1. Before setting any password: check whether Troy-set (Rank 1) is possible → prefer stop-at-gate.
2. If Cursor sets a password: deliver via Rank 2 → else Rank 3 → else Rank 4 → else **abort signup** and mark `OWNER_ACTION_REQUIRED`.
3. Update `CREDENTIALS-INVENTORY.md` with **metadata only** (no secret values).
4. Update Deal Ledger Account Status / Next Action only.
5. Confirm to Troy in the chat summary: username, service URL, delivery method used, and whether he must act.

---

## This session (2026-09-06) — truth table

| Service | Username / email | Password | Delivery |
|---------|------------------|----------|----------|
| Lovable | `tgates@tgttechnologies.com` | **NOT CREATED** by Cursor | Troy must create (Rank 1) |
| All other queue accounts | — | **NOT CREATED** | N/A |

**No passwords exist for Cursor to email or hide.** Nothing was written to the repo as a secret.

---

## Owner setup checklist (unlock Rank 2–3)

- [ ] Reconnect **1Password** MCP (or install CLI) with a vault Troy owns
- [ ] Authenticate **Gmail** or **Outlook** send for credential handoff mail
- [ ] Confirm Troy’s preferred receive address for Rank 3 handoffs
- [ ] Confirm Troy uses 1Password (or Bitwarden) as system of record for secrets
- [ ] Paste this policy into M365 Deal Ledger folder (process doc — no secrets)
