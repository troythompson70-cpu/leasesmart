# TGT GATE 1 — Outlook ingest diagnosis (2026-09-24)

**Project:** TGT Operating System (AppDeploy) — Gate 1 production remediation  
**Role:** Cursor = execution engineer (diagnose only this turn; no architectural change)  
**Status:** **NOT COMPLETE** — awaiting Troy Power Automate run screenshots before any repair  
**Build / FE version observed:** AppDeploy `tgt-operating-system-wjjsv6` · `__APPDEPLOY_APP_VERSION=1790268431535`  
**Repo note:** Live ingest handler lives on AppDeploy, **not** in `leasesmart`. This file vaults probe evidence + diagnosis so Troy remains acceptance authority.

## Locked architecture (accepted)

Microsoft 365 Outlook → Power Automate (`TGT-EmailFeed-IN`) → SharePoint canonical → AppDeploy `POST /api/integrations/outlook/ingest` → Command Center write/update → immediate readback → durable checkpoint → Sledgehammer verification.

**Explicitly out of scope for this Gate 1 repair:** Graph credential rotation, restoring AppDeploy→Graph mailbox auth, re-enabling Sledgehammer to retry the same failure, declaring Gate 1 from a Power Automate “Succeeded” badge alone.

## What was audited in this run

| Check | Result |
|---|---|
| leasesmart contains `/api/integrations/outlook/ingest` implementation | **NO** |
| Lovable workspace projects for AppDeploy source | **0 projects** |
| Candidate library on branch `cursor/graph-auth-appdeploy-secrets-d437` (`tgt-os-graph/src/ingest.js`) | Capture/idempotency helper only — **not** the production HTTP route |
| Production FE bundle paths | Calls Graph `reconcile` / `records` / etc. — **does not** call outlook ingest (backend-only) |
| Production POST ingest without key | **HTTP 401** `Unauthorized ingestion request` → route **exists** |
| Production GET ingest | **HTTP 404** |
| POST to FE host (`*.v2.appdeploy.ai/.../ingest`) | **HTTP 403** CloudFront method-not-allowed |
| POST to `tgttechnologies.com/.../ingest` | **HTTP 404** |
| CORS preflight (Origin `make.powerautomate.com`) | **HTTP 204**; allow-headers = `content-type,x-outlook-ingest-key` |

Probe log (no secrets): `/opt/cursor/artifacts/gate1_ingest_probe_evidence.log`

## Expected ingest contract (evidence-backed so far)

| Item | Evidence |
|---|---|
| Method / path | `POST /api/integrations/outlook/ingest` |
| Correct host | `https://api-v2.appdeploy.ai/app/tgt-operating-system-wjjsv6/...` |
| Wrong host (FE CDN) | `https://tgt-operating-system-wjjsv6.v2.appdeploy.ai/...` → **403** |
| Auth header name | **`x-outlook-ingest-key`** (from CORS `Access-Control-Allow-Headers`) |
| Auth secret | AppDeploy secret `OUTLOOK_INGEST_KEY` (value never retrieved / never printed) |
| Missing/wrong key | **401** `Unauthorized ingestion request` |
| Payload shape / timestamp / message-ID / write+readback / checkpoint | **NOT readable** from leasesmart or FE bundle — requires AppDeploy backend source **or** PA run response body |

## Diagnosis matrix (apply once PA HTTP status is known)

| Observed | Meaning |
|---|---|
| **401** | ingest-key pairing failure (header missing/wrong name, or value ≠ `OUTLOOK_INGEST_KEY`) |
| **403** on FE host | wrong destination URI (CloudFront blocks POST) |
| **404** | endpoint/URI failure (wrong app path or apex) |
| **400** | malformed payload |
| **503** | receiver validation/write/readback blocker |
| **2xx + stale checkpoint** | wrong destination still “succeeding”, skipped branch, wrong payload/message, or checkpoint defect |
| **no HTTP/handoff action** | missing production delivery plumbing (PA Succeeded ≠ AppDeploy ingest) |

## Root-cause status

**Not yet determined.** Evidence eliminates “route missing on correct API host” (401 proves route + auth gate). Evidence does **not** yet identify whether `TGT-EmailFeed-IN` successful runs actually POST to the correct API URI with `x-outlook-ingest-key` and a payload that advances the durable checkpoint past the Duo Security message.

Prior agents often treated Graph AUTH_TEST / MAILBOX GAP as “Gate 1.” That is a **different path**. This Gate 1 is Power Automate push ingest + durable checkpoint — do not conflate.

## What was NOT done (by design)

- No Graph credential rotation  
- No Sledgehammer re-enable  
- No live fabricated intake POSTs  
- No secret values printed  
- No AppDeploy code edit (source inaccessible from this repo)  
- No Gate 1 COMPLETE declaration  

## Blocker — Troy must supply PA run evidence

Open a **successful** `TGT-EmailFeed-IN` run and send Cursor screenshots (or paste) covering:

1. Run overview (Succeeded badge alone is insufficient)  
2. Full action list — identify the outbound HTTP / AppDeploy handoff action (or confirm it is absent)  
3. HTTP action URI (full URL)  
4. Request headers (redact key **value**; show header **name**)  
5. HTTP status code + response body  
6. Whether SharePoint write/readback actions exist and their outcomes  

Until that evidence arrives: **no surgical repair**, **no architectural change**, **Gate 1 remains NOT VERIFIED**.

## Gate 1 acceptance (unchanged)

Two independent real production messages must each complete: PA → AppDeploy ingest → Command Center write/update → immediate readback → durable checkpoint advancement. Only then:

`GATE 1 — COMPLETE — 100% VERIFIED — NO FURTHER MOVEMENT`

Troy remains acceptance authority.

## Gate 2 note (parking only)

Do not certify Gate 2 while it still uses legacy `runSharePointProof()` / direct Graph credential path. Locked model: Power Automate performs canonical SharePoint write + immediate SharePoint readback; AppDeploy verifies durable proof.
