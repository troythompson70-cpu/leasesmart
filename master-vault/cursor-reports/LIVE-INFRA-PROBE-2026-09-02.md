# Live Infrastructure Probe — Netlify + Supabase

**Project:** LeaseSmart by TGT Technologies Inc.
**From:** Cursor Agent (for Troy Thompson / Tee Gates)
**Date:** 2026-09-02
**Scope:** Read-only probes of the live site and the Supabase project the shipped app points at
**Reproduce:** `node scripts/supabase-live-probe.mjs`, plus the `curl` commands quoted below

This closes the open question that was being carried forward across reviews ("are the
renter and staff lanes enforced by RLS, or only client-side?") and documents two problems
found while checking it. Every probe was an unauthenticated `GET` using the public anon key
already committed in `index.html` — nothing here required dashboard access, and nothing
was written.

---

## Finding 1 — `config.js` is not deployed, so auth cannot initialize in production

`index.html` loads auth config with `<script src="config.js"></script>`. `config.js` is
gitignored, and after the Pages workflow was retired nothing generates it at deploy time.
It is absent from the Netlify deploy:

```bash
curl -sI https://leasesmart.tgttechnologies.com/config.js | grep -iE 'HTTP|content-type'
# HTTP/2 200 · content-type: text/html; charset=UTF-8   ← index.html, not a script
```

The 200 is misleading. `_redirects` (`/* /index.html 200`) rewrites unmatched paths to the
app, so a file that was never deployed answers 200 with HTML. Static files still win over
the rewrite, which is what makes this conclusive rather than ambiguous:

```bash
curl -sI https://leasesmart.tgttechnologies.com/command-center.html | grep -i content-length
# content-length: 20451   ← matches the repo file exactly, so real files are served as themselves
```

Consequence: the browser is handed HTML where it expects JavaScript, `window.LEASESMART_CONFIG`
stays `null`, and the guarded client init never runs. **Both** lanes — renter magic link and
staff password — fail before any email is requested, and the UI reports "Supabase is not
configured" rather than an email delivery error.

This is a production auth outage independent of SMTP, and it is consistent with the
long-running "magic link never worked" symptom. It is a plausible mechanism for that
history, not proof of it: this probe shows today's state, not what was deployed during past
attempts.

---

## Finding 2 — the retired Pages mirror pointed at a Supabase project that does not exist

Three project refs have appeared in this repo. Only one resolves:

| Ref | Source | Resolves | Evidence |
|-----|--------|----------|----------|
| `iajaftjnfxrywqgccdef` | `SUPABASE_URL` in `index.html` (shipped app) | **Yes** | `/auth/v1/health` → 200 with key, 401 without |
| `wsxsnbgvbrebbusgokmp` | `SUPABASE_URL` repo secret → Pages `config.js` | No | no DNS record; `curl` fails to resolve |
| `jufxyuqcgijaiuyratlp` | earlier `SUPABASE-EMAIL-SETUP.md` | No | no DNS record |

The Pages mirror was live and serving (`troythompson70-cpu.github.io/leasesmart` returned
200 with the current `LS_BUILD`), and its generated `config.js` named the dead
`wsxsnbgvbrebbusgokmp` ref. So the mirror shipped a build whose auth could not work either,
by a different mechanism than Finding 1.

A non-resolving ref proves the ref is not live today. It does not distinguish a typo from a
project that was deleted after being used correctly, so treat a bad ref as a **contributing**
cause to eliminate, not as a diagnosed root cause. The `SUPABASE_URL` / `SUPABASE_ANON_KEY`
repo secrets are now unused and should be deleted or corrected so they cannot mislead again.

---

## Finding 3 — the lane split has no server-side enforcement because the tables do not exist

Answering the carried-forward RLS question directly: there are no RLS policies to review on
the lane-split tables, because **none of those tables exist in the live project**. Of 17
tables the sprints define, 15 are absent from the live schema — including `users` and
`profiles` from the one non-draft migration.

| Table | Anon access | Rows visible to anon |
|-------|-------------|----------------------|
| `gov_listings` | readable | 23,610 (public HUD data — intended) |
| `listings` | readable, empty | 0 |
| `users`, `profiles`, `organizations`, `organization_staff`, `organization_invites`, `organization_audit_logs`, `case_manager_clients`, `agencies`, `agency_users`, `case_clients`, `case_notes`, `client_assignments`, `landlord_intelligence`, `in_app_notifications`, `notification_outbox` | **not in live schema** | n/a |

The probe distinguishes "missing" (`PGRST205` — not in the schema cache) from "denied"
(401/403 — RLS refusing), which is why this is a schema fact rather than an inference.

What this means for the security question:

- The renter/staff split is enforced **client-side only** today. There is no server-side
  authorization boundary because there is no server-side user data — app state lives in
  `localStorage`, and the only live table is public reference data.
- Nothing is currently bypassable in a way that exposes another user's data. There is no
  other user's data on the server to reach.
- The exposure appears the moment any of those tables is created. The RLS policies in
  `supabase/drafts/` and `supabase/migrations/DRAFT_sprint_auth1_enterprise.sql` are written
  but unapplied, so **applying schema without applying its policies is the live risk** —
  and that risk is invisible to any client-side test.
- Recommended gate: before the first real table lands, verify with this probe that every new
  table reports `denied` or `anon_empty` for the anon role, never `anon_readable`, except
  deliberately public reference data such as `gov_listings`.

`gov_listings` being anon-readable is correct: it is published HUD data and the app fetches
it with the anon key from the browser.

---

## Status

| Finding | Action |
|---------|--------|
| 1 — `config.js` not deployed | **Fixed** — auth now falls back to the `index.html` constants, with `config.js` kept as a local override |
| 2 — dead project refs | Docs corrected (PR #2); Pages mirror and its secrets retired |
| 3 — no server-side lane enforcement | No action needed today; becomes a release gate before any real table is created |

Nothing in this report was applied to Supabase. No schema, policy, or dashboard change was
made from this session.
