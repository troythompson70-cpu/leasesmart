# DEPLOY THESE FILES TO LIVE SITE NOW

## I cannot deploy from Cursor to your Netlify account

**Deployment target:** https://leasesmart.tgttechnologies.com  
**You must upload/push these files yourself.**

---

## Project structure (no separate CSS/JS)

| File | Required |
|------|----------|
| `index.html` | **YES — entire app (HTML + CSS + JS)** |
| `_redirects` | YES for Netlify SPA |
| `style.css` | **Does not exist** |
| `script.js` | **Does not exist** |

---

## How to deploy (Netlify)

1. Copy `c:\Users\T 25\Desktop\CURSOR\index.html` to your Netlify site root (replace old file).
2. Copy `_redirects` to site root.
3. In Netlify: **Deploys → Trigger deploy → Clear cache and deploy site**.
4. Wait ~60 seconds.

---

## Verify live (do not skip)

Open in **private/incognito** browser:

```
https://leasesmart.tgttechnologies.com/?v=20260521-v1.1.4
```

**You MUST see at top:**

> **LeaseSmart Beta v1.1 Functional Fix Build — Updated Today — Build 20260521-v1.1.4**

If you do NOT see that text, the old file is still live or cache is stale.

---

## Test steps (Troy)

### Fix 1 — Calendar (step 4, after phone)
1. Start Demo Search.
2. Name, email, phone → Move-in date step.
3. **Expect:** native date field (not a list of “ASAP / June 1”).
4. Pick a date → auto-advances OR tap Continue.

### Fix 2 — Laundry checkboxes (step 16)
1. Reach Laundry question.
2. **Expect:** real **checkboxes** (square boxes), not single-choice buttons only.
3. Check 2+ options → “Selected: …” line updates → Confirm Selection.

### Fix 3 — Listings dashboard
1. Finish last question (Anything else).
2. **Expect:** short loading (~2 sec) then **8 listing cards**.
3. Map, Details, Call Guide tab work.

---

## Build ID in source

Search `index.html` for: `LS_BUILD = '20260521-v1.1.4'`

Change this string every deploy to force cache bust.
