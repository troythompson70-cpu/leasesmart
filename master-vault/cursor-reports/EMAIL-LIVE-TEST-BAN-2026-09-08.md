# Stop Live Exchange Probes + Intake Hardening

**Date:** 2026-09-08  
**Sprint:** EMAIL-LIVE-TEST-BAN + INTAKE  
**Build ID:** 20260908-stop-live-email-tests-intake  
**Branch:** `cursor/stop-live-email-tests-intake-67c5`  
**Security:** No secrets in this report.

---

## Claude verification (accepted)

Claude verified Outlook directly. Prior Cursor handoff claiming **“Tips newsletter (/api/intake): PASS — no Outlook”** is **FALSE**.

- Live Tips signup through production `/api/intake` triggers real Exchange traffic (“Welcome to TGT Tips”).
- Fabricated probe addresses NDR into the real inbox.
- Patterns confirmed: `live-diag@`, `overnight-gateway-*`, `overnight-bridge*`, `overnight-puppeteer@`, `live-sp-map-*`, `final-check-*`, `live-ui-e2e-*`, `live-v3-*`, `cors2@`, `cors-test@` (`@tgttechnologies.com`) plus `status-test@example.com`.
- Latest hit cited by Claude: **2026-09-08 13:14:02 UTC** — same day as the false PASS.
- `$280` laptop mailto on live ChatGPT apex still broken (`URLSearchParams` → literal `+`, blank Name/callback).

---

## What this branch does

| Item | Detail |
|---|---|
| Hard ban rule | `.cursor/rules/no-live-exchange-probes.mdc` — always apply |
| Client probe guard | `src/lib/intake-probe-guard.ts` blocks fabricated emails on production hosts |
| Local intake | `server/intake-http.ts` remains **mock / no SMTP** (`X-TGT-Intake-Mode: local-mock-no-smtp`) |
| Laptop inquire | Already routed to `/api/intake` (no mailto) |
| Tips signup (repo) | Converted from mailto → `/api/intake` newsletter |
| Mailto encoding | Documented + tested: `encodeURIComponent` only (never `URLSearchParams`) |
| Policy test | `npm run test:intake` includes `assert-no-live-intake-probes` |

---

## Explicit Cursor instruction (durable)

**Stop firing live production Exchange sends from automated/CI tests.**

1. Never POST to `https://tgttechnologies.com/api/intake` with fabricated addresses.  
2. Route all automated form tests through **local Vite** `/api/intake` (mock, no SMTP).  
3. Do not treat UI success on the live Tips form as “no Outlook” — production intake still mails via Exchange and NDRs prove it.  
4. Keep probe-email guards and this rule in force for future agents.

---

## Live cutover still required

Apex `tgttechnologies.com` → `custom-domains.chatgpt.site` is **not** this repo deploy.

- Repo `tgt-website` now has laptop + tips on protected intake (local mock).  
- Live ChatGPT site still needs the same laptop mailto → intake conversion applied, **or** DNS cutover to this app.  
- Until then, real prospects on the live `$280` mailto path still get broken `+` encoding.

---

## Test plan (this PR)

- `npm run test:intake` — validation + probe guard + mailto `%20` + no-live-fetch policy  
- `npm run lint` / `npm run build`  
- Local preview: Tips + laptop modal POST to localhost `/api/intake` only  
- **No** production intake POSTs from this agent
