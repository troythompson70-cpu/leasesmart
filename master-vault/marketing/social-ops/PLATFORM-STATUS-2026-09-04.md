# TGT Social Media Operations Workstream

**Date:** 2026-09-04  
**Owner gate:** Troy approval required before any publish / paid / SMS  
**System of record:** Microsoft 365 (`TGT BUSINESS / MARKETING / 2026 MARKETING COMMAND CENTER / 03 Content Calendar`)  
**Repo mirror:** `master-vault/marketing/social-ops/`  
**Security:** Never store passwords, tokens, API keys, or recovery codes in this file.

## Hard rules (from PM handoff)

- Do **not** activate SMS.
- Do **not** launch paid advertising.
- Do **not** publish social content without Troy approval.
- Use existing approved Labor Day campaign assets.
- Do **not** regenerate Troy’s face / AI likeness without approval.
- Microsoft 365 remains the permanent record; this repo mirror is execution evidence.

## Platform status matrix (read-only probe 2026-09-04)

| Platform | Candidate handle / URL | Status observed | Notes | Owner gate |
|---|---|---|---|---|
| Link hub | `linktr.ee/tgttechnologies` | Not found (404) | Need owned Linktree / link hub | Troy: choose handle + approve publish |
| Link hub | `linktr.ee/tgt` | Exists but **unrelated** | Japanese creator account — do **not** use | Avoid |
| TikTok | `@tgttechnologies` | Not found | Brand handle available to claim (verify in-app) | Troy: create/claim + approve |
| TikTok | `@teegates` | Exists (Tee Gates) | Low activity / empty content as probed | Troy: confirm ownership + bio |
| Facebook | `facebook.com/TGTTechnologies` | Exists | Page titled TGT Technologies (~91 followers observed) | Troy: confirm admin access + bio |
| Instagram | `@tgttechnologies` | Exists (login-walled) | Public content not fully visible without auth | Troy: confirm ownership + bio |
| Instagram | `@teegates` | Exists (login-walled) | Confirm if founder personal brand | Troy: confirm |
| YouTube | `@teegates` | Exists (Trevor Gates) | Channel present; content sparse / empty as probed | Troy: confirm naming + upload rights |
| YouTube | `@TGTTechnologies` | Not found (404) | Do not link until claimed | Fixed homepage WATCH MORE → `@teegates` |
| LinkedIn | company `tgttechnologies` / `tgt-technologies` | Not found (404) | Company page likely needs creation | Troy: create/claim when ready |

## Recommended link hub destinations (draft — not published)

Use only after Troy approval. Destination order for consumer conversion:

1. Homepage tips signup — `https://tgttechnologies.com/#signup` (after conversion deploy)
2. Labor Day $280 laptop — `https://tgttechnologies.com/#laptop`
3. Ask Gates / tips — `https://tgttechnologies.com/#gates`
4. Remote help — `https://tgttechnologies.com/#remote-help`
5. Business referral — `https://tgttechnologies.com/#referral`
6. Business IT assessment — `https://tgttechnologies.com/#business-it`
7. YouTube — `https://www.youtube.com/@teegates`
8. Contact — `mailto:info@tgttechnologies.com`

## Draft bios (not published)

### Brand (TGT Technologies)

> Tech made simple. AI made useful. Tips, scam alerts, AI-ready laptops, and real tech help for people and small businesses. NY / NJ / CT.

### Founder (Gates / Tee Gates)

> Real tech tips. Real answers. No jargon. Founder, TGT Technologies.

## Assets checklist (no binaries stored here)

| Asset | Status | Source rule |
|---|---|---|
| Labor Day laptop creative | Use existing approved campaign assets | Do not regenerate |
| Gates / Troy face | Use existing approved stills only | Do not regenerate likeness |
| Logo (`tgt-logo-2026.svg`) | Available in `tgt-website/public/media/` | Approved brand mark |
| Homepage hero / support imagery | Reused from live site media | Preserve visual system |

## Analytics / tracking (planned — no secrets)

| Surface | Measurement | Status |
|---|---|---|
| Website CTAs | `dataLayer` / GA4 events (`signup_*`, `laptop_inquiry`, `video_play`, `remote_help_inquiry`, `referral_click`, `business_assessment_click`, `ask_gates_click`) | Wired in `tgt-website` |
| Social posts | Platform native insights only after Troy publish approval | Not activated |
| UTM convention (draft) | `utm_source={platform}&utm_medium=social&utm_campaign=labor_day_2026` | Not launched |

## Next actions (execution queue)

1. **Troy:** Provide Microsoft 365 access / share link for `TGT_WEBSITE_SOCIAL_LAUNCH_HANDOFF_2026-09-04.md` so Cursor can sync results to the permanent record.
2. **Troy:** Confirm ownership of Facebook, Instagram `@tgttechnologies`, TikTok `@teegates`, YouTube `@teegates`.
3. **Troy:** Approve Linktree/link-hub handle (not `linktr.ee/tgt`).
4. **Troy:** Approve draft bios + Labor Day creative package before any publish.
5. **Cursor (after approvals):** Populate link hub destinations pointing at conversion homepage anchors.
6. **Cursor/Troy:** Claim missing brand handles (TikTok brand, YouTube brand, LinkedIn company) only with Troy present for 2FA/email.
7. Keep SMS off. Keep paid ads off. Keep content unpublished until explicit GO.

## Owner approvals required

- [ ] Publish any social post
- [ ] Create/claim new brand handles
- [ ] Activate Linktree / link hub publicly
- [ ] Paid advertising
- [ ] SMS / text programs
- [ ] Deploy conversion homepage to production apex (`tgttechnologies.com`)
