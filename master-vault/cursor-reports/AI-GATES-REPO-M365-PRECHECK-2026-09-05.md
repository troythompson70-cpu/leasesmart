# AI Gates Commercial Licensing — Repository + Microsoft 365 Pre-Check

**Date:** 2026-09-05  
**Executor:** Cursor Cloud Agent  
**Directive:** AI Gates Commercial Licensing — PM Implementation Directive  
**Branch:** `cursor/ai-gates-precheck-identity-b657`  
**Security:** No API keys, tokens, or secrets in this report.  
**Rule:** No invented status. No contract submission. No external outreach. No automated legal acceptance.

---

## 1. EXISTING STRUCTURE FOUND

### Repository (verified local checkout: `troythompson70-cpu/leasesmart`)

| Area | Exact path(s) | Notes |
|---|---|---|
| LeaseSmart SPA | `index.html` | Primary product UI (~8963 lines) |
| LeaseSmart Command Center (product/ops) | `command-center.html` | Sprint F1 internal Triple-AI / sprint tool — **not** Marketing Command Center |
| Config | `config.js`, `config.example.js`, `.env.example` | Local/demo config |
| Seeds | `_data/*.js` | Demo/sandbox seed data |
| Scripts | `scripts/*.mjs` | Sprint log, morning checklist, handoff copy, probes, domain guide |
| QA | `_qa/*.mjs`, `_qa/*.html` | Regression / UI snapshots |
| TGT public site | `tgt-website/` | Vite + React marketing site (Hero, Sections/MeetGates, TipsSignup, LaptopInquiry) |
| Master Vault (repo mirror) | `master-vault/` | Upload target for M365 Master Vault |
| Identity standard (NEW this run) | `master-vault/IDENTITY-STANDARD.md` | Tee Gates vs Troy Thompson policy |
| AI routing | `master-vault/ai-comms/AI-REVIEW-ROUTING.md`, `AI-SHARED-LOG.json` | Claude ↔ ChatGPT routing |
| Sprint handoffs | `master-vault/sprints/HANDOFF-*-latest.html` | Historical sprint handoffs |
| Morning ops | `master-vault/morning/` | Morning review + handoff HTML |
| Cursor reports | `master-vault/cursor-reports/` | Execution / compliance / infra probes |
| Marketing mirror | `master-vault/marketing/README.md`, `master-vault/marketing/social-ops/` | MCC mirror only |
| Supabase applied migration | `supabase/migrations/20260523100000_sprint_a1_foundation.sql` | users, profiles, listings, saved_*, feedback, sessions, beta_agreements, referrals, notifications, listing_verifications |
| Supabase DRAFT migration | `supabase/migrations/DRAFT_sprint_auth1_enterprise.sql` | organizations, staff, invites, audit, case_manager_clients |
| Supabase drafts (not AI Gates) | `supabase/drafts/sprint_*.sql` | LeaseSmart agency/case/landlord/billing/legal/security tables |

### Schemas / databases / tables (verified in repo)

**No AI Gates / likeness / commercial-licensing tables exist.**

LeaseSmart-related tables only (foundation + drafts): agencies, agency_roles, agency_users, case_*, landlord_*, billing_*, notification_*, consent/cookie/retention, organizations (AUTH1 draft), etc. See `supabase/` paths above.

### Marketing Command Center

| Item | Status | Path |
|---|---|---|
| M365 Marketing Command Center | Documented as SoT; **not readable from this environment** | `TGT BUSINESS → MARKETING → 2026 MARKETING COMMAND CENTER` |
| Content Calendar subfolder | Documented | `… → 03 Content Calendar` |
| Known handoff filename | Documented only | `TGT_WEBSITE_SOCIAL_LAUNCH_HANDOFF_2026-09-04.md` |
| Repo mirror | Exists | `master-vault/marketing/` |
| Social ops tracker | Exists | `master-vault/marketing/social-ops/PLATFORM-STATUS-2026-09-04.md` |
| M365 paste instructions | Exists | `master-vault/marketing/social-ops/M365-PASTE-INSTRUCTIONS.md` |

### Business-development / opportunity trackers

| Item | Status |
|---|---|
| Dedicated BD CRM / opportunity tracker DB | **Not found** in repo |
| LeaseSmart “opportunity” references | NYC.gov opportunity benefits URL / opportunity_zone field — **not** sales CRM |
| ChatGPT PM / media-sales structuring | Governance role only (no repo CRM) |

### Microsoft 365 / SharePoint / Power Automate

| Item | Verified status |
|---|---|
| Live SharePoint browse | **BLOCKED** — no M365/SharePoint/OneDrive MCP; `az` CLI not installed; Notion/Coda/Google Drive MCP `needsAuth`; prior probe: `tgttechnologies.sharepoint.com` does not resolve from agent env |
| Documented Master Vault | Upload target referenced as **Microsoft 365 Master Vault** / `Master Vault / Cursor Reports` |
| Documented MCC path | `TGT BUSINESS → MARKETING → 2026 MARKETING COMMAND CENTER` |
| Power Automate workflows | Referenced only as planned TGT Tips signup email path in `AI-REVIEW-ROUTING.md` — **no workflow definitions in repo** |
| Templates | Handoff HTML templates in `master-vault/sprints/`, `scripts/handoff-copy-lib.mjs` |

### Dashboards

| Dashboard | Path | Role |
|---|---|---|
| LeaseSmart Command Center v2 | `command-center.html` | Internal sprint/AI review |
| LeaseSmart product dashboards | `index.html` (auth/case/admin panels) | Product |
| Marketing Command Center | M365 only (not in repo) | Marketing SoT |
| AI Gates licensing dashboard | **Does not exist** | Gap |

### Master Vault documentation (repo)

- `master-vault/README.md`
- `master-vault/IDENTITY-STANDARD.md` (added this run)
- `master-vault/AI-CONTEXT-SNAPSHOT.md`
- `master-vault/LeaseSmart-Sprint-Master-Log.md`
- `master-vault/DOMAIN-SETUP-GUIDE.md`
- `master-vault/SUPABASE-EMAIL-SETUP.md`
- `master-vault/AUTH1-MAGIC-LINK-DIAGNOSIS.md`
- `master-vault/ai-comms/*`
- `master-vault/cursor-reports/*`
- `master-vault/marketing/*`
- `master-vault/morning/*`
- `master-vault/sprints/*`

### AI Gates commercial asset

| Search | Result |
|---|---|
| `AI Gates` / `AIGates` / `ai-gates` / `ai_gates` in repo | **No matches** |
| Public founder brand | **Tee Gates** already used on LeaseSmart feedback/footer and `tgt-website` MeetGates alt text |
| Handles | `@teegates` documented on TikTok/IG/YouTube probes |

---

## 2. IDENTITY CORRECTIONS

### Files where `T. Gates` was found

**None.** Full-repo + recent git history search for `T. Gates` / `T Gates` returned zero hits.

### Files changed to Tee Gates (completed this run)

These were **operational/brand** updates (not `T. Gates` string replacements — none existed):

| File | Change |
|---|---|
| `master-vault/IDENTITY-STANDARD.md` | **Created** — FINAL identity policy |
| `master-vault/README.md` | Identity standard linked; operational owner → Tee Gates |
| `master-vault/ai-comms/AI-REVIEW-ROUTING.md` | Owner / approval / photo-library wording → Tee Gates; likeness flagged OWNER APPROVAL REQUIRED |
| `master-vault/marketing/social-ops/PLATFORM-STATUS-2026-09-04.md` | Owner gates, likeness, bios owner actions → Tee Gates |

Public-facing surfaces already using Tee Gates (no change needed): `index.html`, `_qa/ui-*.html`, `tgt-website/src/components/Sections.tsx`.

### Files where Troy Thompson remains (legal / admin — intentional)

| File | Why retained |
|---|---|
| `master-vault/SUPABASE-EMAIL-SETUP.md` | Dashboard admin / SMTP applied-by legal-account context (`Troy Thompson / admin`) |
| `master-vault/cursor-reports/DATA-A1-COMPLIANCE-REPORT-2026-05-30.md` | Historical dual label `Troy Thompson / Tee Gates` on GO authorization |
| `master-vault/cursor-reports/LIVE-INFRA-PROBE-2026-09-02.md` | Historical dual label on author line |

### Ambiguous references requiring review (NOT changed — fail closed)

| Location | Ambiguity |
|---|---|
| Widespread “Troy” shorthand in sprint handoffs / morning review / master log | Could mean operational owner (→ Tee Gates) or commit-phrase operator / GitHub admin; historical records not rewritten |
| `index.html` “Demo: Platform Admin (Troy)” / B5 Platform Admin (Troy) | Demo/admin persona vs brand identity |
| `command-center.html` CSS/timeline class `.troy` / `--cc-troy` | Internal agent-lane color naming |
| YouTube `@teegates` observed as **Trevor Gates** | Platform display-name conflict — ownership/naming confirmation required |
| `PLATFORM-STATUS` “Gates / Tee Gates” founder bio title | Acceptable short form; confirm whether “Gates” alone remains brand-safe |
| Repo remote / GitHub org slug containing legal personal name | Outside doc scope; do not alter |

---

## 3. REUSE / EXTEND

Do **not** create duplicate systems. Prefer:

| Existing | Reuse for AI Gates licensing |
|---|---|
| `master-vault/` + M365 Master Vault | Document SoT + licensing policy / license registers (markdown first) |
| `master-vault/marketing/` + M365 Marketing Command Center | Campaign / commercial outreach folders — extend MCC, do not fork |
| `master-vault/ai-comms/AI-REVIEW-ROUTING.md` + Copy-for-Claude handoffs | Claude risk-review queue for licensing terms |
| `scripts/handoff-copy-lib.mjs` / sprint handoff HTML pattern | Owner + Claude review packets |
| `command-center.html` | Optional later **status panel** for license expiration tracking fields only — do not build a second CRM |
| `tgt-website/` | Public brand surface already uses Tee Gates |
| Supabase LeaseSmart schemas | **Do not overload** housing/case tables with likeness licensing; if DB tracking is approved later, add a **new dedicated draft schema** under `supabase/drafts/` after Claude review |

**Explicit non-creates:** second CRM; second Marketing Command Center; duplicate opportunity tracker; duplicate BD database; competing Master Vault; competing SoT.

---

## 4. GAPS

Verified missing (not assumed away):

| Capability | Status |
|---|---|
| AI Gates asset registry | Missing |
| Likeness-rights fields | Missing |
| Voice-rights tracking | Missing |
| License period / start / expiration | Missing |
| 60/30/7-day threshold status fields | Missing |
| Expired / renewal status fields | Missing (notifications must stay **off**) |
| Usage territory | Missing |
| Paid-advertising permissions | Missing |
| Exclusivity tracking | Missing |
| AI-training prohibition fields | Missing |
| Sublicensing controls | Missing |
| Compensation tracking | Missing |
| Claude risk-review status field | Missing as structured field (routing doc exists) |
| Owner approval status field | Missing as structured field (owner gates exist in social-ops prose only) |
| Fail-closed `NOT AUTHORIZED` default enum | Missing |
| M365 live folder verification | Blocked (no access) |
| Power Automate workflow inventory | Not in repo; cannot verify live |

---

## 5. PROPOSED CHANGES (not implemented yet)

### Files to modify / add (implementation phase — pending Claude + owner)

| Action | Path |
|---|---|
| Add | `master-vault/ai-gates/README.md` — index under Master Vault (M365 mirror path TBD after live MCC/Master Vault inspect) |
| Add | `master-vault/ai-gates/LICENSE-REGISTER.md` — tracking table (fields only; no notifications) |
| Add | `master-vault/ai-gates/CLAUDE-REVIEW-QUEUE.md` |
| Add | `master-vault/ai-gates/OWNER-APPROVAL-QUEUE.md` |
| Add (draft only) | `supabase/drafts/ai_gates_licensing.sql` — optional later DB mirror of register fields |
| Extend | `master-vault/marketing/` — link AI Gates campaign materials into existing MCC mirror |
| Extend | `master-vault/ai-comms/AI-REVIEW-ROUTING.md` — add AI Gates licensing review classifications (SAFE / REQUIRES NEGOTIATION / OWNER APPROVAL REQUIRED / REJECT) |
| Update | Remaining ambiguous operational “Troy” docs **only after** Tee Gates confirms rewrite scope for historical handoffs |

### Tables / fields to add (draft schema — not applied)

Proposed register fields (tracking only):

- `license_id`, `counterparty`, `asset_type` (likeness / voice / digital replica / campaign package)
- `usage_scope`, `territory`, `paid_ads_allowed`, `exclusivity`, `sublicensing_allowed`
- `ai_training_prohibited`, `derivative_works_allowed`, `post_campaign_usage`
- `compensation_terms_ref`, `license_start`, `license_end`
- `threshold_60`, `threshold_30`, `threshold_7`, `expired_status`, `renewal_status`
- `claude_risk_status`, `owner_approval_status`, `authorization_status` (default **NOT AUTHORIZED**)
- `source_document_path` (M365), `notes`

**Do not activate automated notifications.**

### Workflows to extend

- None until live Power Automate inventory is available via M365 access.
- Do **not** invent new Automate flows for legal acceptance.

### M365 locations affected (documented; live confirm blocked)

| Location | Intended use |
|---|---|
| Microsoft 365 Master Vault | Permanent copy of identity standard + AI Gates register |
| `TGT BUSINESS → MARKETING → 2026 MARKETING COMMAND CENTER` | Campaign / commercial materials (reuse; do not fork) |
| New subfolder under MCC or Master Vault | **Only if** live inspect shows no existing AI Gates / licensing folder — otherwise reuse |

---

## CLAUDE REVIEW QUEUE

Route before any contract language or schema apply:

1. Likeness / AI-avatar / voice / digital-replica field definitions  
2. AI model training prohibition language  
3. Derivative works, sublicensing, exclusivity, indemnification  
4. Content ownership / platform licensing / perpetual rights  
5. Territory, post-campaign usage, takedown requirements  
6. Arbitration, governing law, renewal language  
7. Any draft `supabase/drafts/ai_gates_licensing.sql` before apply  
8. YouTube `@teegates` / “Trevor Gates” naming conflict implications  

Claude may classify: **SAFE** | **REQUIRES NEGOTIATION** | **OWNER APPROVAL REQUIRED** | **REJECT**  
Claude does **not** provide final business approval.

---

## OWNER APPROVAL QUEUE

Tee Gates sole final approval required for:

1. Contract acceptance / commercial licensing terms  
2. Likeness / voice / AI-avatar licensing  
3. Exclusivity, sublicensing, model-training permissions  
4. Paid-ad usage / extended usage / rights transfers  
5. Payment commitments  
6. Whether historical “Troy” operational docs should be mass-rewritten  
7. M365 share-link / signed-in access for Cursor live inspect  
8. Social platform KYC/verification when legal identity is required (then use **Troy Thompson**)

Default for missing/ambiguous/unverified campaign terms: **NOT AUTHORIZED**.

---

## BLOCKERS / CONFLICTS

1. **M365 live structure unverified** — permanent SoT not browsable from this agent environment.  
2. **No AI Gates structures exist yet** — implementation must extend Master Vault / MCC, not invent a parallel SoT.  
3. **Identity string `T. Gates` absent** — no literal correction available; operational “Troy” shorthand remains ambiguous pending owner scope decision.  
4. **YouTube display name “Trevor Gates”** vs brand Tee Gates — ownership/naming conflict.  
5. Conflict rule: if live M365 architecture differs from this repo mirror → **FAIL CLOSED AND REPORT** (do not silently replace).

---

## NEXT EXECUTION STEP

**One action:** After Tee Gates provides M365 read access (share link or signed-in Graph/SharePoint), Cursor will inventory the live Master Vault + Marketing Command Center folder tree and report exact existing paths before creating any `master-vault/ai-gates/` folder or draft license-register schema.

If M365 access is not available and Tee Gates authorizes repo-only scaffolding: create `master-vault/ai-gates/LICENSE-REGISTER.md` tracking fields only (no notifications, no contracts, default `NOT AUTHORIZED`) and route field definitions to Claude review.

---

## Evidence commands (this run)

- Repo-wide search: `T. Gates` → 0 hits  
- Repo-wide search: `Troy Thompson` → retained legal/historical hits listed above  
- Repo-wide search: AI Gates variants → 0 hits  
- M365 probe: no SharePoint MCP; Azure Storage available but unrelated; `az` missing  
