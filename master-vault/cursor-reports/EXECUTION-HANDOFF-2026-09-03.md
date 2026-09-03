# LeaseSmart Execution Handoff — 2026-09-03

**Project:** LeaseSmart by TGT Technologies Inc.  
**From:** Cursor (cloud agent)  
**For:** Agent Inbox / `AI_HANDOFF.md` append  
**Status:** COMMITTED on `main`

## Merged (in order)

| PR | Title | Merged at (UTC) |
|----|-------|-----------------|
| #1 | Fix regression chain and correct stale deploy docs | 2026-09-03T02:05:40Z |
| #3 | Fix deployed auth config, retire the Pages mirror | 2026-09-03T02:06:37Z |
| #4 | Cloud Agent dev environment config | 2026-09-03T02:06:48Z |
| #2 | Point SMTP setup doc at correct Supabase project | 2026-09-03T02:06:52Z |

**#3 vs #4:** No dependency. #4 only adds `.cursor/environment.json` + `_qa/package-lock.json`. Merged #1 → #3 → #4 → #2.

## Deploy

- Live: https://leasesmart.tgttechnologies.com
- Build: `20260902-v2.14.1-authcfg`
- Host: Netlify (`leasesmart2.netlify.app`)
- Auth config source live: `index.html` (fallback) — `config.js` still absent/`text/html` (expected)

## AUTH retest (live)

| Check | Result |
|-------|--------|
| AUTH_CONFIG | **PASS** — no “Copy config.example.js” banner; `LS_SUPABASE_CONFIG_SOURCE=index.html` |
| AUTH_REQUEST | **PASS** — POST `…/auth/v1/otp` → **200** on `iajaftjnfxrywqgccdef` |
| AUTH_EMAIL | **PASS (UI)** — “Magic link sent…”; inbox not verified from Cursor |
| **OVERALL_AUTH** | **PASS** |

Probe email used in UI only: `leasesmart-auth-probe@tgttechnologies.com` (no inbox access).

## Pages mirror teardown

- Repo: `CNAME` deleted, `.github/workflows/pages.yml` deleted (via #3).
- GitHub Pages **site setting still enabled** — Cursor token lacks admin (`DELETE /pages` → 403).
- Mirror still responds: https://troythompson70-cpu.github.io/leasesmart/ (stale host, not the custom domain).
- **Troy action required:** Repo → Settings → Pages → **Disable**.

## Docs

- `master-vault/DOMAIN-SETUP-GUIDE.md` now documents Netlify as live host (merged in #3).

## Out of scope (Troy only — not Cursor)

1. Disable GitHub Pages in repo settings (403 for agent).
2. Confirm magic-link email arrived in a real inbox / custom SMTP if deliverability fails.
3. `app.tgttechnologies.com` CNAME remove or finish Pages custom domain.
4. SPF/DKIM/DMARC email DNS fix (MX is M365; SPF still GoDaddy `-all`).
5. Paste/append this file into Office 365 Agent Inbox `AI_HANDOFF.md` (Cursor has no vault write access).

## Architecture (confirmed)

- Netlify hosts the site.
- Supabase `iajaftjnfxrywqgccdef` backs auth + `gov_listings`.
- Hybrid — not an open decision.
