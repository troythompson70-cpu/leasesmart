# OWNER ACTION — Graph credentials for TGT Command Center Production

**Status:** `OWNER_ACTION_REQUIRED: APPDEPLOY_SECRET_ENTRY`

Production AppDeploy app `tgt-operating-system-wjjsv6` (safe baseline **v44 / 1789734343421**) is missing the Graph client-credential secret path.

## Do this (Troy only — never paste secrets into Cursor)

### 1) Confirm Entra app (do not create a duplicate)

Open: https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

Find existing app named exactly: **TGT Command Center Production**

Required application permissions (admin consent):

- `Mail.Read`
- `Sites.ReadWrite.All`

Do **not** add: `Mail.Send`, `Mail.ReadWrite`, `Directory.ReadWrite.All`, `Sites.FullControl.All`

### 2) Enter AppDeploy protected secrets

In the AppDeploy secret store for `tgt-operating-system-wjjsv6`, create/update:

| Secret name | Paste from |
|-------------|------------|
| `GRAPH_TENANT_ID` | Entra tenant ID |
| `GRAPH_CLIENT_ID` | Application (client) ID |
| `GRAPH_CLIENT_SECRET` | Client secret **value** |

Keep `OUTLOOK_INGEST_KEY` as-is until Graph delta cutover is verified.

### 3) Deployment credits

AppDeploy API currently returns `402 APP_TEMPORARILY_UNAVAILABLE`.  
Do **not** replace v44 until credits/availability return and the `tgt-os-graph` candidate is transplanted + reviewed.

## Agent cannot complete without you

- No AppDeploy source tree in `leasesmart` (Lovable auth unavailable this session).
- No permission to display or invent Graph secret values.
- No outbound email / Cisco-Jared automation (hard hold).
