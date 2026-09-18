# Phase 1 audit — TGT OS Microsoft Graph integration (2026-09-18)

**Project:** LeaseSmart / TGT Revenue Command Center  
**Build ID:** 20260918-tgt-graph-integration-audit  
**Status:** AUDIT COMPLETE — IMPLEMENTATION CANDIDATE IN-REPO — PRODUCTION NOT MODIFIED  
**Safe production baseline confirmed:** `tgt-operating-system-wjjsv6` / `1789734343421` (v44)

## 1. Repository structure

| Area | Role vs Graph |
|------|----------------|
| `revenue-command-center/` | Local UI + fixtures; consumes SharePoint feed schema; **no Graph client** |
| `tgt-orchestrator/` | AIWO queue/evidence; **no Graph client** |
| `tgt-website/` | Marketing intake; **no Command Center Graph** |
| `supabase/` | LeaseSmart auth/data; unrelated to TGT OS Graph |
| `master-vault/` | Audits/evidence only |
| `tgt-os-graph/` (**new**) | Portable Graph auth/client/Outlook/SharePoint/ingest candidate for AppDeploy transplant |

**Critical:** Live TGT OS application code runs on AppDeploy, **not** in this git tree. Prior vault report (`TGT-OS-OUTLOOK-INGESTION-AUDIT-2026-09-15.md`) remains correct on that point.

## 2. Git / branch

- Repo: `troythompson70-cpu/leasesmart`
- Base at audit start: `main` @ `be5cd1c` (vault Outlook ingestion audit #16)
- Feature branch: `cursor/tgt-graph-integration-candidate-d437`

## 3. AppDeploy production version (executed check)

```
GET https://tgt-operating-system-wjjsv6.v2.appdeploy.ai/ → 200
appVersion = 1789734343421
```

Matches required safe baseline v44 / `1789734343421`. **No deploy performed.**

## 4. Environment / secret names (values never displayed)

| Name | Where observed | Status |
|------|----------------|--------|
| `OUTLOOK_INGEST_KEY` | Prior production audit / mission brief | Reported present on AppDeploy |
| `GRAPH_TENANT_ID` | Mission brief — required for client credentials | **MISSING** (owner entry required) |
| `GRAPH_CLIENT_ID` | Mission brief | **MISSING** |
| `GRAPH_CLIENT_SECRET` | Mission brief | **MISSING** |
| `GRAPH_ACCESS_TOKEN` | — | **Must not** be permanently stored |

LeaseSmart `.env.example` only documents Supabase keys — no Graph vars (correct for this repo).

## 5. Production client evidence (bundle inspection)

Frontend talks to `https://api-v2.appdeploy.ai/app/tgt-operating-system-wjjsv6` with cookies.

Observed API surface (auth required; unauthenticated SPA rewrite returns HTML):

- `/api/session`, `/api/records`, `/api/activity`, `/api/intelligence`, `/api/email-review`
- `/api/sharepoint/verify` → expects `proof` with `state=VERIFIED`, `itemId`, `eTag|hash`, `webUrl`
- Health UI: `health.mailSync.state` / `coverageState`; SharePoint proof via Graph item identity
- UI copy: Refresh **does not** pull new Outlook mail — separate sync path

No `GRAPH_*` secrets in frontend bundle (good).

## 6. AppDeploy API credit / availability (executed)

```
GET https://api-v2.appdeploy.ai/app/tgt-operating-system-wjjsv6 → 402
body.code = APP_TEMPORARILY_UNAVAILABLE
```

**DEPLOYMENT_BLOCKED** until AppDeploy availability/credits restore. Static v44 frontend still serves.

## 7. Mailbox fixtures (read-only Graph via Outlook MCP as tgates@)

| Fixture | Evidence |
|---------|----------|
| Cisco Duo reminder | Inbox `2026-09-18T10:01:40Z` — `msp@cisco.com` — **HARD HOLD read-only** |
| NinjaOne / Max Farrell | Inbox `2026-09-15T15:59:35Z` |
| PC Matic | Inbox `2026-09-16T02:23:15Z` — `smensah@pcmatic.com` |

No messages sent, replied, or drafted.

## 8. Gaps vs required end-to-end architecture

| Required | Production today (evidence) |
|----------|-----------------------------|
| One Entra service identity + client credentials | Not verifiable from leasesmart; Azure MCP timed out / no Entra app APIs |
| Server token cache | Not in this repo; prod secrets path incomplete |
| Outlook delta + ImmutableId + lifecycle | Push/`OUTLOOK_INGEST_KEY` path historically; durable delta not in leasesmart |
| SharePoint ID/delta | UI proof shape exists; server worker not in leasesmart |
| Durable dedupe beyond rolling 500 | Not inspectable without AppDeploy source |
| Atomic capture + visible readback | UI enforces `verificationState=VERIFIED` on writes; Graph mail path incomplete |

## 9. Blockers (owner / platform)

1. `OWNER_ACTION_REQUIRED: APPDEPLOY_SECRET_ENTRY` — set `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` in AppDeploy secrets (do not paste into chat).
2. `OWNER_ACTION_REQUIRED: MICROSOFT_ADMIN_CONSENT` — if consent not yet granted for Mail.Read + Sites.ReadWrite.All on **TGT Command Center Production**.
3. AppDeploy source access — Lovable MCP auth timed out; cannot edit live AppDeploy tree from this agent.
4. `DEPLOYMENT_BLOCKED_CREDIT_RESET` / `APP_TEMPORARILY_UNAVAILABLE` — do not deploy; keep v44.

## 10. What this agent built (candidate only)

`tgt-os-graph/` — auth, Graph client+retry, Outlook delta/lifecycle, SharePoint ID/delta, atomic ingest/dedupe, deterministic tests.  
**Not self-VERIFIED for production.** Status target: `READY_FOR_REVIEW` of candidate + owner actions before any AppDeploy transplant/deploy.
