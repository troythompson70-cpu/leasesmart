# TGT Website Outlook / Forms Status Report

**Date:** 2026-09-08  
**Executor:** Cursor Cloud Agent (`bc-01a08123-1f0c-756d-aea3-099b56d25be0`)  
**Live URL tested:** https://tgttechnologies.com/  
**Security:** No passwords, tokens, or secrets stored in this report.

---

## Verdict for dashboard

| Surface | Status | Notes |
|---|---|---|
| Site load | **PASS** | Live apex returns HTTP 200; conversion-style homepage is live |
| TGT Tips newsletter | **PASS** | Submits on-page via protected `/api/intake` — **no Outlook / mailto** |
| Free IT Assessment | **PASS** | On-page form; validation works; copy says no email app required |
| Microsoft Bookings | **PASS** | Embed + new-tab calendar load; Free IT Consultation slots visible |
| $280 laptop inquire | **WATCH** | Still `mailto:info@tgttechnologies.com` → OS mail-reader prompt (Outlook path) |
| Cross-form redirect (“opens another form”) | **NOT OBSERVED** | Sections stay on their own anchors; no forced jump between forms |

**Overall:** Outlook-related errors on newsletter + assessment appear **fixed**. Remaining Outlook/mail-client behavior is limited to the **laptop inquire** mailto CTA.

---

## What Troy asked

1. Were Outlook errors fixed when using the website?  
2. Is the site opening up to another form?  
3. Was the website tested?  
4. Need a report / status update on the dashboard.

---

## How intake works on live (verified from shipped JS + UI)

Live config (from production bundle):

- `intake.mode` = `api`
- `intake.apiEndpoint` = `/api/intake`
- `intake.formsparkId` = empty (Formspark path off)
- `bookings.enabled` = true
- Bookings URL = Microsoft Bookings for `TGTTECHNOLOGIESINC@…onmicrosoft.com`

API probe (safe, invalid body only):

- `OPTIONS/GET` → 405 Allow: POST (expected)
- `POST {}` → `{"ok":false,"error":"invalid_request"}` (endpoint alive)

---

## Manual test results (2026-09-08)

### 1) Newsletter / TGT Tips — PASS

- Filled test email `status-test@example.com`, selected iPhone, submitted.
- Success copy: **“Thank you — you're signed up for TGT Tips.”**
- Explicit UX: signup saves on this page — **no extra questionnaire**.
- **No Outlook compose window.**

### 2) Microsoft Bookings — PASS

- `#assessment` consultation block embeds Bookings; CTA opens Bookings calendar.
- Calendar showed **Free IT Consultation** (30 min) with available Eastern Time slots (e.g. Sep 10, 2026).
- No Outlook login error on the public booking page during this probe.

### 3) Free IT Assessment — PASS

- Form visible with required Name / Email / Callback.
- Empty submit → field errors: “Name is required.” / “Email is required.” / “Best callback number is required.”
- On-screen note: submits through TGT’s protected intake route — **no email app required**.

### 4) $280 laptop inquire — WATCH (mailto)

- Button: **Inquire about $280 laptop**
- Triggers `mailto:info@tgttechnologies.com?subject=TGT+$280+Laptop+inquiry…`
- OS dialog: **Choose Preferred Application / Mail Reader** (Outlook path possible).
- This is the only live CTA that still forces an email client instead of the API form.

### 5) “Opens another form” — NOT OBSERVED

- Newsletter stays on `#newsletter` after success.
- Assessment stays on `#assessment`.
- Bookings opens Microsoft Bookings (calendar), not a second TGT form.
- Laptop inquire opens mail client, not a second website form.

If “another form” meant Outlook’s compose window, that still happens **only** on the laptop mailto CTA.

---

## Evidence artifacts

| File | What it shows |
|---|---|
| `/opt/cursor/artifacts/tgt-live-hero-2026-09-08.webp` | Live hero |
| `/opt/cursor/artifacts/tgt-live-newsletter-result-2026-09-08.webp` | Tips signup success (API) |
| `/opt/cursor/artifacts/tgt-live-assessment-form-2026-09-08.webp` | Assessment validation |
| `/opt/cursor/artifacts/tgt-live-booking-section-2026-09-08.webp` | Bookings embed on site |
| `/opt/cursor/artifacts/tgt-live-bookings-page-2026-09-08.webp` | Bookings calendar slots |
| `/opt/cursor/artifacts/tgt-live-laptop-mailto-prompt-2026-09-08.webp` | Mailto → mail-reader dialog |
| `/opt/cursor/artifacts/tgt-outlook-forms-status-demo.mp4` | Walkthrough demo |

---

## Repo vs live note

In-repo `tgt-website/` (Labor Day conversion PR #6) still uses mailto helpers for tips/laptop in source. **Production apex currently serves a newer intake build** (API newsletter + assessment + Bookings). Dashboard status below is for **live production**, not the older in-repo mailto-only preview.

---

## Owner follow-ups (optional)

1. Convert **Inquire about $280 laptop** from mailto → same `/api/intake` pattern as assessment/tips (removes last Outlook dependency).  
2. Confirm whether Troy’s “opens another form” meant laptop mailto (Outlook) or something else on a specific device.  
3. Paste this report into M365 Marketing Command Center / Content Calendar when convenient.

---

## Dashboard paste (Command Center Briefing)

```
TGT LIVE FORMS STATUS — 2026-09-08
Site: PASS
Tips newsletter (API): PASS — no Outlook
Assessment form: PASS — no Outlook
Microsoft Bookings: PASS
Laptop inquire mailto: WATCH — still opens mail reader / Outlook path
Opens-another-form redirect: NOT OBSERVED
Overall: Outlook errors fixed on tips + assessment; one mailto CTA remains
```
