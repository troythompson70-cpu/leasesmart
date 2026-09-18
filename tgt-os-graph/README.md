# TGT OS Graph — AppDeploy transplant candidate

Portable **server-side** Microsoft Graph integration for `tgt-operating-system-wjjsv6`.

This package is **not** the live AppDeploy source tree (that code is not in `leasesmart`).  
It is the deterministic candidate to transplant into the AppDeploy backend when:

1. AppDeploy deployment credits are available (API currently returns `402` / `APP_TEMPORARILY_UNAVAILABLE`).
2. Protected secrets are set (never in git):
   - `GRAPH_TENANT_ID`
   - `GRAPH_CLIENT_ID`
   - `GRAPH_CLIENT_SECRET`
3. Entra app **TGT Command Center Production** has admin consent for:
   - `Mail.Read`
   - `Sites.ReadWrite.All`
4. **Do not** grant `Mail.Send`, `Mail.ReadWrite`, `Directory.ReadWrite.All`, `Sites.FullControl.All`.

## Architecture (one of each)

1. One Entra service identity  
2. One protected credential source (AppDeploy secrets)  
3. One shared `GraphClient` (`src/client.js`)  
4. One Outlook reconciliation worker (`reconcileOutlookDelta` + lifecycle)  
5. One SharePoint reconciliation worker (`reconcileSharePointDelta`)  
6. One atomic idempotent ingestion boundary (`atomicCapture`)  
7. One controlled production evidence run (post-deploy only)

## Safe production baseline (do not replace until candidate passes review)

- App: `tgt-operating-system-wjjsv6`
- Version: `1789734343421` (v44)
- URL: https://tgt-operating-system-wjjsv6.v2.appdeploy.ai/

## Owner secret entry (no paste into Cursor)

AppDeploy app secrets UI → add exactly:

| Secret name | Value source |
|-------------|--------------|
| `GRAPH_TENANT_ID` | Entra tenant ID |
| `GRAPH_CLIENT_ID` | App registration application (client) ID for **TGT Command Center Production** |
| `GRAPH_CLIENT_SECRET` | Client secret value from that registration |

Keep existing `OUTLOOK_INGEST_KEY` if push intake remains during cutover.

Entra portal: https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

## Tests

```bash
cd tgt-os-graph && npm test
```

Covers: AUTH, ImmutableId Prefer header, 429/503 retry, Outlook delta, lifecycle, SharePoint ID/delta, atomic capture, dedupe/replay, restart persistence, Cisco hard-hold.

## Hard holds

- No outbound email in any test.
- Cisco / Jared (`jmillika@cisco.com`, `cisco.com`) is **READ_ONLY**.
- Never log tokens, secrets, or full mailbox bodies in production logs.
