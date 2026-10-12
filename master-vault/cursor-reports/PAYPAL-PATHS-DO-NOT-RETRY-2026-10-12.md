# PayPal cart — what works, what failed, what not to repeat

Date: 2026-10-12
Live host: `https://tgttechnologies.com` → CNAME `custom-domains.chatgpt.site`
Sites project: `appgprj_6a8fb5d9596c8191a045ee1e5744fffd`
Command Center: not touched
Deployment this session: none

## Seen on the live cart

Filled the cart (Lenovo, ship-to, `tgates@tgttechnologies.com`) and clicked **Pay $280.00 with PayPal**.

- Page stayed on `/cart`
- Message: `PayPal checkout is temporarily unavailable.`
- `POST /api/paypal/create-order` returned HTTP 502 `{"ok":false,"error":"paypal_auth_failed"}`
- Screenshot: `/opt/cursor/artifacts/cart-pay-click.png`

That server call is the broken path. Do not send it again to “confirm.”

## Works — use these

| Check | Result |
|---|---|
| `GET /api/paypal/config` | HTTP 200, `environment: live`, `notificationsConfigured: true`, client id present |
| PayPal JS SDK script for that client id | HTTP 200, `application/javascript` |
| `/cart` page | HTTP 200, shows **$280.00** and **Pay $280.00 with PayPal** |

The public client id is enough for PayPal’s browser SDK (`paypal.Buttons`). The stored server secret is what PayPal rejects. Checkout has to use the SDK when `create-order` returns `paypal_auth_failed`.

## Failed — do not repeat

| Attempt | Result | Do not |
|---|---|---|
| `POST /api/paypal/create-order` | 502 `paypal_auth_failed` | Call it again, or run a $1 / $280 capture |
| `git ls-remote` on `git.chatgpt-team.site` | `could not read Username` | Push or ls-remote again from this machine |
| 1Password MCP | Auth timed out | Open the vault again this session |
| Codex CLI `login status` | Not logged in | Start another Codex login loop |
| Commit `cd885d5` | Not a git object here. OneDrive tarball has no `.git` | Invent a new commit and call it `cd885d5` |
| `/ai-made-simple` | Browser gets the homepage. Other clients get HTTP 404 `Not found`. Live JS has no `ai-made-simple` | Treat HTTP 200 as the ebook page |
| Local PayPal button iframe wait | Timed out once. Stopped. | Rerun that screenshot loop |

## Fix written, not published

`master-vault/cursor-reports/sites-paypal-sdk/PayPalCheckout.jsx`

On `paypal_auth_failed` for the $280 cart, the page loads `https://www.paypal.com/sdk/js` with the client id from `/api/paypal/config` and renders PayPal’s own button for **$280.00**. The server create-order path stays first, so a later good secret still redirects to PayPal’s approve URL.

In the Sites checkout, `server/paypal.js` `accessToken` now trims the client id and secret before the OAuth call. That file is in the Sites source tree used for this session, not in the LeaseSmart app that Netlify ships.

`tgttechnologies.com` is still the old bundle. This repo does not publish that host. Do not deploy LeaseSmart and expect the cart to change.
