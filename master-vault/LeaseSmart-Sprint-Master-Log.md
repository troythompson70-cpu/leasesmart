# LeaseSmart Sprint Master Log

**TGT Technologies Inc.** — Upload this file to Microsoft 365 Master Vault.

This log records sprint commands, Claude reviews, GO/NO-GO decisions, and Cursor reports.
Secrets are stripped automatically — never paste API keys or passwords here.

---
## 2026-05-26 21:41 UTC — B2 — Sprint Command

**Build ID:** 20260526-v1.2.0-c1

Sprint B2 — build documentation logger, morning checklist, regression harness

---
## 2026-05-26 21:41 UTC — B2 — Cursor Report

**Build ID:** 20260526-v1.2.0-c1

Agent 1: scripts/sprint-log.mjs + master-vault/LeaseSmart-Sprint-Master-Log.md with auto-redaction. Agent 2: scripts/morning-checklist.mjs generates Troy 2-minute morning review. Agent 3: _qa/sprint-b2-regression.mjs confirms A6+C1.

---
## 2026-05-26 21:41 UTC — B2 — GO / NO-GO Decision

**Build ID:** 20260526-v1.2.0-c1

**Verdict:** NO-GO

B2 tooling complete. A6 and C1 regression PASS. Not committed — waiting for Troy commit phrase.

---
## 2026-05-26 21:46 UTC — B4 — Sprint Command

**Build ID:** 20260526-v1.3.0-b4

Sprint B4-Foundation — agency case architecture skeleton (draft SQL, roles, UI, notes)

---
## 2026-05-26 21:46 UTC — B4 — Cursor Report

**Build ID:** 20260526-v1.3.0-b4

Built 10-table draft schema, 7-role permission model, DEMO/INTERNAL workspace UI, case notes auto-save (1s), mock seed only. Regression PASS 48/48. A6/C1/B2 intact.

---
## 2026-05-26 21:46 UTC — B4 — GO / NO-GO Decision

**Build ID:** 20260526-v1.3.0-b4

**Verdict:** NO-GO

Architecture skeleton only. Draft SQL not applied. Waiting for Troy commit phrase.

---
## 2026-05-26 22:04 UTC — C2-C3-B5-B3 — Sprint Command

**Build ID:** 20260526-v1.4.0

Sprint v1.4.0 — C2 case mgmt, C3 reporting, B5 platform admin, B3 user data

---
## 2026-05-26 22:04 UTC — C2-C3-B5-B3 — Cursor Report

**Build ID:** 20260526-v1.4.0

Built internal skeletons at build 20260526-v1.4.0. C2 uses B4 permissions. All dummy data. Regression PASS 48/48.

---
## 2026-05-26 22:04 UTC — C2-C3-B5-B3 — GO / NO-GO Decision

**Build ID:** 20260526-v1.4.0

**Verdict:** NO-GO

Skeleton only. Not committed. Waiting for Troy commit phrase.

---
## 2026-05-26 22:17 UTC — D1 — Sprint Command

**Build ID:** 20260526-v1.5.0-d1

Sprint D1 — email notifications, follow-up reminders, in-app panel

---
## 2026-05-26 22:17 UTC — D1 — Cursor Report

**Build ID:** 20260526-v1.5.0-d1

Built D1 at 20260526-v1.5.0-d1. Draft SQL for notification_outbox. Email placeholder until Supabase live. Regression PASS 41/41, all nested suites PASS.

---
## 2026-05-26 22:17 UTC — D1 — GO / NO-GO Decision

**Build ID:** 20260526-v1.5.0-d1

**Verdict:** NO-GO

Not committed — waiting for Troy commit phrase.

---
## 2026-05-30 — DATA-A1 — Sprint Command (Addendum)

**Build ID:** 20260530-v2.14.0-data-a1

NEWARK DATA A1 DATABASE — Landlord Listings / Housing Inventory layer required (not public-resource-only). Office 365 Vault rule acknowledged.

---
## 2026-05-30 — DATA-A1 — Cursor Report

**Build ID:** 20260530-v2.14.0-data-a1

Landlord inventory: 8 sandbox listings, 9 provider registry entries, caseworker cards on Newark panel + workbench link. No scrape, no live feeds, LS_STORE only. QA 29/29 PASS. Full report: `master-vault/cursor-reports/DATA-A1-COMPLIANCE-REPORT-2026-05-30.md` (upload to Office 365 Cursor Reports).

---
## 2026-05-30 — DATA-A1 — GO / NO-GO Decision

**Build ID:** 20260530-v2.14.0-data-a1

**Verdict:** GO (Troy) — committed `9fdaf9c`, pushed `main`.

---
## 2026-05-31 — DATA-A1 — Regression gate (Chain Test 10)

**Build ID:** 20260530-v2.14.0-data-a1

**Chain Test 10:** PASS 61/61 (`sprint-c1pro-regression-test.mjs`). Fixes: A6 build-id allowlist `14.0-data-a1`; Newark banned-word scan excludes DATA-A1 block; seed rename Manual Landlord Registry (no “Verified” in copy). **Uncommitted locally** until Troy GO.

**DATA-A1 QA:** 29/29 PASS (unchanged).

**Vault:** Upload `master-vault/cursor-reports/DATA-A1-COMPLIANCE-REPORT-2026-05-30.md` to Office 365 Cursor Reports — **pending Troy/PM**.

**Troy live-tested:** Not confirmed by Cursor.

---
## 2026-09-02 11:34 UTC — QA-CHAIN-REPAIR — Claude Review

**Build ID:** 20260530-v2.14.0-data-a1

**Verdict:** GO

Independently verified PR #1: cloned branch, re-ran all 22 suites from scratch, results match exactly (f1 45/45, c1pro 61/61, e1 58/58). Netlify CNAME doc fix confirmed in repo files. C1 auth fix confirmed: exactly one password call scoped inside auth1SubmitProLogin, renter lane still requires OTP. PR #1 confirmed not merged. Regenerated master-vault docs scanned for secrets - clean. Verdict GO. Caveat: C1 lane split is code-level static enforcement only; no visibility into whether Supabase RLS independently enforces it. Follow-ups (non-blocking): decide on dual Netlify/GH Pages deploy, and reconcile the two Supabase config paths.

---
## 2026-09-02 11:34 UTC — QA-CHAIN-REPAIR — GO / NO-GO Decision

**Build ID:** 20260530-v2.14.0-data-a1

**Verdict:** GO

PR #1 verified GO by Claude. NOT MERGED - awaiting Troy commit phrase per repo convention. Separate finding logged: SUPABASE-EMAIL-SETUP.md named the wrong Supabase project for SMTP setup.

---
## 2026-09-02 11:34 UTC — SUPABASE-PROJECT-REF — Cursor Report

**Build ID:** 20260530-v2.14.0-data-a1

SMTP setup doc named project jufxyuqcgijaiuyratlp, but the deployed app authenticates against iajaftjnfxrywqgccdef - verified from the live config.js and the hardcoded constants in index.html. SMTP configured on the named project would never have sent LeaseSmart login emails, which matches SMTP being a long-standing open blocker. Doc now names the operative project and includes a command to re-confirm the ref. Fixed on its own branch so PR #1 stays exactly as Claude verified it.

---
## 2026-09-02 15:31 UTC — QA-CHAIN-REPAIR — Sprint Command

**Build ID:** 20260530-v2.14.0-data-a1

Troy approved. PR #1 and PR #2 moved from draft to ready for review. Merge deliberately withheld pending the exact commit phrase per repo convention, and pending confirmation of which Supabase project is authoritative for PR #2.

---
