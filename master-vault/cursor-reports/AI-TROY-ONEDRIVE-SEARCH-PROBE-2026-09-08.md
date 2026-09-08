# AI Troy / OneDrive–SharePoint Search Probe — 2026-09-08

**Executor:** Cursor Cloud Agent  
**Ask:** Search all shared documents / entire OneDrive and shared folders for AI Troy work.  
**Security:** No secrets. No credentials entered.

---

## Verdict

**BLOCKED on live OneDrive/SharePoint search.** Cursor cannot open the Master Vault, AI Troy ledger, or shared folders until Troy connects M365 access.

What *was* found:

| Source | Result |
|---|---|
| Repo `master-vault/` (local shared-doc mirror) | Partial AI Troy context — see below |
| OneDrive / SharePoint MCP | **Not installed** in this Cursor environment |
| Browser M365 session | **Not signed in** |
| Correct tenant hostname | **Discovered:** `netorgft7859571.sharepoint.com` (+ `-my` OneDrive) |
| Wrong hostname (docs sometimes imply brand domain) | `tgttechnologies.sharepoint.com` → **NXDOMAIN** (does not resolve) |

---

## Live M365 probe evidence

| URL | Reachable | Auth | AI Troy docs |
|---|---|---|---|
| `https://www.office.com/` | Yes | Login wall | None |
| `https://onedrive.live.com/` | Yes | Login wall | None |
| `https://tgttechnologies.sharepoint.com/` | No (DNS fail) | — | — |
| `https://tgttechnologies-my.sharepoint.com/` | No (DNS fail) | — | — |
| `https://netorgft7859571.sharepoint.com/` | Yes | Login wall (tenant live) | None without sign-in |
| `https://netorgft7859571-my.sharepoint.com/` | Yes | Login wall (OneDrive) | None without sign-in |

Tenant identity corroboration (no secrets): Bookings / DNS already use `NETORGFT7859571.onmicrosoft.com`.

Artifacts:

- `/opt/cursor/artifacts/m365-probe-1.webp` … `m365-probe-4.webp`
- `/opt/cursor/artifacts/m365-tenant-sharepoint.webp`
- `/opt/cursor/artifacts/m365-tenant-onedrive.webp`

Setup request filed for Troy: connect Graph/SharePoint/OneDrive MCP **or** paste share links **or** sync folders into `master-vault/`.

---

## What local shared docs already say about AI Troy

From repo mirrors only (not live ledger):

### 1) Active AI Troy ops item (highest priority)

From Claude check-in `CLD-2026-09-08-001` (mirrored):

- Live ledger **untouched**; write **blocked** (~159KB > ~60KB ceiling)
- Pending SharePoint doc: `AI_TROY_CHECKIN_PENDING_CLD-2026-09-08-001.md`
- Item 7 **Gates Online** still: approved historically, **never staged**, presumed **Off**
- ~6-day check-in schedule gap
- Troy must pick size-fix: archive / split / append tool / raise limit

**AI Troy lane implication:** until size-fix lands, check-ins cannot log to the live ledger. That is the blocking AI Troy systems problem.

### 2) Known M365 permanent paths (when access exists)

| Path | Purpose |
|---|---|
| Microsoft 365 **Master Vault** | LeaseSmart / Cursor reports permanent record |
| `TGT BUSINESS → MARKETING → 2026 MARKETING COMMAND CENTER → 03 Content Calendar` | Marketing/social handoffs |
| Same folder as ledger | `AI_TROY_CHECKIN_PENDING_CLD-2026-09-08-001.md` |

### 3) Product / marketing AI Troy mentions

- `AI-REVIEW-ROUTING.md`: “Approved Troy/AI Troy photo library and next campaign” under ChatGPT review focus (2026-09-04) — **owner approval** still required before publish
- Social ops / website conversion reports: M365 is system of record; repo is mirror only
- Prior agents already recorded: **no M365 MCP** in this cloud environment

### 4) Not found locally

- Full live ledger text
- `ai-troy.md` / Gates Online status doc contents
- Codex handoffs
- Scheduled-task run history
- Any OneDrive file listing

---

## What Cursor can usefully do for AI Troy *after* access

Once Troy unlocks M365 read:

1. Locate Master Vault + AI Troy ledger + pending check-in doc on `netorgft7859571`  
2. Inventory recent CLD-* entries after `CLD-2026-09-02-009`  
3. Confirm Item 7 Gates Online state from primary docs  
4. Propose a concrete size-fix PR/process (still Troy chooses option)  
5. Draft next AI Troy check-in entry offline for paste once writes work again  

Until then, Cursor should **not** invent ledger items or stage Gates Online.

---

## Recommended Troy unlock (pick one)

1. **Best:** Connect Microsoft Graph / SharePoint / OneDrive MCP and sign in  
2. Paste share links to Master Vault + AI Troy folder + pending check-in doc  
3. Export those folders into `master-vault/` in this repo  

Also confirm the live SharePoint site URL uses **`netorgft7859571.sharepoint.com`**, not `tgttechnologies.sharepoint.com`.

---

## Dashboard paste

```
AI TROY / ONEDRIVE SEARCH — 2026-09-08
Live OneDrive/SharePoint search: BLOCKED (no MCP, no signed-in session)
Tenant found: netorgft7859571.sharepoint.com (login wall)
Wrong host tgttechnologies.sharepoint.com: NXDOMAIN
Local mirror AI Troy signal: ledger size write blocked; Item 7 still Off; pending CLD-2026-09-08-001
Next: Troy connects M365 access or pastes share links
```
