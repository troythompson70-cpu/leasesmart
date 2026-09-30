# OWNER ACTION — Gate 1 HTTP handoff (required)

**For:** Troy (Power Automate + AppDeploy secrets)  
**Blocked state:** TGT-EmailFeed-IN has no AppDeploy POST → Command Center checkpoint STALE on Duo 2179189.  
**Do not:** rotate Graph secrets, call graph/reconcile, or re-enable `sledgehammer-production-sweep-v10`.

## A. Confirm missing handoff (2 minutes)

1. Open [TGT-EmailFeed-IN](https://make.powerautomate.com/environments/Default-a1bd1d54-1b1f-4e0c-b575-f2938aee86a8/flows/bafc73d1-854d-4543-b6a2-b3a2240988e7?v3=true)
2. Run history → newest Succeeded run → expand every action.
3. If there is no HTTP/Webhook to `api-v2.appdeploy.ai/.../outlook/ingest`, handoff is missing (matches Cursor classification).

## B. Add POST after Create item

1. AppDeploy → `tgt-operating-system-wjjsv6` → Secrets → copy **value** of ingest key (`OUTLOOK_INGEST_KEY` or current name). Never paste into chat.
2. Edit flow → inside the branch that creates the Email Feed row → add **HTTP**:
   - POST `https://api-v2.appdeploy.ai/app/tgt-operating-system-wjjsv6/api/integrations/outlook/ingest`
   - Header `x-tgt-ingest-key`: (secret value)
   - JSON body from Outlook trigger fields (message id, subject, from, received time, body/preview, direction IN)
3. Save. Keep flow On.

## C. Prove Email #1 then #2

1. Real mail #1 through Inbox → PA run shows HTTP 2xx + body → Command Center card updates → readback → checkpoint leaves Duo.
2. Independent real mail #2, same chain.
3. Only then: **GATE 1 — COMPLETE — 100% VERIFIED — NO FURTHER MOVEMENT** and freeze before Gate 2.

## D. If HTTP exists but fails

Use status only: 401 key · 404 URI · 400 payload · 503 receiver · 2xx+stale wrong destination.
