# Laptop Inquire → `/api/intake` Conversion

**Date:** 2026-09-08  
**Sprint:** LAPTOP-INTAKE-API  
**Build ID:** 20260908-laptop-intake-api  
**Branch:** `cursor/laptop-intake-api-5be0`  
**Claude call:** Convert laptop mailto → `/api/intake` (next GO)  
**Security:** No secrets in this report.

---

## Decision

Claude reviewed the Outlook/forms status report and called **GO** on converting the last Outlook-dependent path (laptop inquire mailto) to the same protected `/api/intake` route used by Tips + Assessment.

---

## What shipped (this repo)

| Change | Detail |
|---|---|
| `tgt-website/src/lib/intake.ts` | Client submit with `laptop_inquiry` + assessment fallback |
| `tgt-website/src/lib/intake-validate.ts` | Shared schema 1.1 validation |
| `tgt-website/server/intake-http.ts` | Dev/preview `/api/intake` handler |
| `tgt-website/vite.config.ts` | Middleware for `/api/intake` on dev + preview |
| `LaptopInquiryModal.tsx` | No mailto — posts intake, shows on-page success |
| `scripts/intake-validation-check.mjs` | 5/5 validation checks |

Copy under the modal now says: **Submits through TGT's protected intake route. No email app is required.**

---

## Test results

| Check | Result |
|---|---|
| `npm run test:intake` | **5/5 PASS** |
| `npm run lint` | **PASS** (clean) |
| `npm run build` | **PASS** |
| Local `POST /api/intake` laptop_inquiry | **PASS** (`ok/delivery/requestId`) |
| Modal validation (empty submit) | Manual — see artifacts |
| Modal success (no Outlook) | Manual — see artifacts |

---

## Important production note

Live apex `tgttechnologies.com` currently CNAME → `custom-domains.chatgpt.site` (ChatGPT custom domains), **not** this `tgt-website/` Vite app.

- This PR removes mailto from the **in-repo conversion homepage**.
- Live ChatGPT-hosted site still has `Inquire about $280 laptop` as mailto until Troy applies the same pattern there **or** cuts DNS over to a deploy of this app.
- Client includes **assessment fallback** so a ChatGPT-hosted API that only accepts `newsletter`/`assessment` can still durably take laptop leads once the client is updated.

### Live cutover options

1. **Preferred:** Deploy this `tgt-website` build + intake API, point apex at it.  
2. **Interim on ChatGPT site:** Replace mailto CTA with a form that POSTs `laptop_inquiry` (or assessment fallback) to `/api/intake`.

---

## Owner items

- [ ] Troy: Aikido MCP sign-in (still blocked for SAST)  
- [ ] Troy: Choose live cutover path (ChatGPT editor vs deploy this repo)  
- [ ] Optional: convert remaining Tips mailto in this same `tgt-website` tree for full parity with live Tips API

---

## Dashboard paste

```
LAPTOP-INTAKE-API — 2026-09-08
Laptop inquire mailto → /api/intake: DONE in tgt-website
Validation tests: 5/5 PASS
Build/lint: PASS
Outlook path removed from laptop modal (local preview)
Live ChatGPT custom-domain apex still needs cutover/apply
```
