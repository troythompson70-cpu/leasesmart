# TGT OS Graph — production truth + continuation (2026-09-21)

**Sources:** ChatGPT AppDeploy inspection + Cursor repair package + Troy operating directive  
**Status:** `OWNER_ACTION_REQUIRED: APPDEPLOY_APPLY_GRAPH_AUTH`  
**Freeze:** v98 / `1789910277389` `FROZEN_FOR_GRAPH_REPAIR`  
**Rollback-only:** v44 / `1789734343421`  
**Claude:** **SUSPENDED — DO NOT USE** (architect replacement: Gemini; apply: ChatGPT)

## Corrected facts vs Sep 18 handoff

| Item | Sep 18 handoff | Sep 21 truth |
|------|----------------|--------------|
| Live version | assumed v44 locked | **v98 / 1789910277389** |
| Public API URL | 402 credit block | still 404 publicly |
| Authenticated AppDeploy | unavailable to Cursor | **working for ChatGPT** |
| Secret **names** | missing | **all four present** |
| Actual failure | credit block | **AADSTS7000215 / HTTP 401** |
| Cron | n/a | `sledgehammer-production-sweep-v3` disabled after 10 failures |
| Root defect | secrets missing | **hard-coded tenant/client IDs in `backend/graph-auth.ts`** |

## Cursor deliverable (PR #28)

- Drop-in: `tgt-os-graph/appdeploy/graph-auth.ts`
- Transplant notes: `tgt-os-graph/appdeploy/GRAPH-AUTH-TRANSPLANT.md`
- Local AUTH adapter tests (mock `secrets.readSecret`) — **28/28 PASS**, not production VERIFIED
- Operating model vaulted: `master-vault/OPERATING-MODEL-2026-09-21.md`
- Handoffs: ChatGPT apply + Gemini risk — `master-vault/morning/HANDOFF-latest.html`

## Continuation check (this agent turn)

| Probe | Result |
|-------|--------|
| Re-run `tgt-os-graph` tests | **28/28 PASS** |
| Lovable MCP projects in `TGT's Lovable` | **0** — Cursor still cannot apply |
| Public `*.lovable.app` preview URLs | **404 Project not found** |
| Outlook scan for AADSTS/sledgehammer alerts | No matching ops failure mail in top hits |
| UI rework | **Not started** (per directive) |

## Still blocked on ChatGPT + Troy

- AppDeploy write of `backend/graph-auth.ts`
- Production AUTH_TEST
- Cron remains disabled (correct)
- No VERIFIED claim
