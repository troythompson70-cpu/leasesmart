# Command Center Cloud Cutover — 2026-09-28

**Owner:** Cursor (no Troy input for code path)  
**Status:** Packaging COMMITTED · **Live apex still FAIL** until host cutover

## Diagnosis (why apex 404s)

| Route | Apex `tgttechnologies.com` | Notes |
|---|---|---|
| `/api/paypal/*` | Works | Hosted on Cloudflare → `custom-domains.chatgpt.site` allowlist |
| `/api/intake` | Works | Same |
| `/command-center` | **404** plain `Not found` | Not mounted on ChatGPT custom-domain router |
| `/api/dashboard-feed` | **404** | Same — Vite middleware is local-only today |

LeaseSmart Netlify (`leasesmart.tgttechnologies.com`) SPA-falls `/command-center` to LeaseSmart HTML — not the Revenue Command Center. `/api/dashboard-feed` there is still 404.

## What this branch adds

1. `npm run sync:command-center` — copies `revenue-command-center/` → `tgt-website/public/command-center/`
2. Build runs sync before Vite so `dist/command-center/` ships with the site
3. `_redirects` serves `/command-center` static + routes `/api/dashboard-feed` to Netlify function
4. `netlify/functions/dashboard-feed.ts` — fail-closed Graph proxy (never marks VERIFIED)
5. Root `netlify.toml` — publish `tgt-website/dist` + functions

## What still blocks LIVE apex green

Apex DNS still terminates on **ChatGPT custom domains**, which only expose the PayPal/intake APIs. Merging this PR does **not** change that origin by itself.

**To clear EQ-CC-CLOUD-CUTOVER on apex:**

1. Publish this build to the production origin (Netlify production for the apex, or replace the ChatGPT custom-domain origin with this `dist` + functions), **or**
2. Point `tgttechnologies.com` at the Netlify site that builds from this `netlify.toml`, **and**
3. Set Graph env vars in the host UI (never in chat/git): tenant/client/secret or refresh token.

Until live `GET https://tgttechnologies.com/command-center/` returns the RCC HTML and `GET /api/dashboard-feed` returns JSON (or explicit 503 missingEnv — not plain 404), Command Center stays **FAIL E2E**.

## Local packaging proof

`npm run test:cc-cutover` in `tgt-website/` — sync + redirects + function path checks.
