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

The public client id loads PayPal’s browser SDK. Loading that script is not a payment. A browser `actions.order.create` lets the buyer change the amount, and `actions.order.capture()` never checks that PayPal captured `280.00`. That fallback was removed. Do not put it back.

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

## Prepared source, not published

`master-vault/cursor-reports/sites-publication-2026-10-12/`

- `PayPalCheckout.jsx` only redirects to the server `approveUrl`. It does not load the PayPal JS SDK and it does not capture in the browser.
- `paypal.js` sets the order amount to `280.00` on the server. Capture loads the order first and returns `409 amount_not_allowed` unless the currency is `USD` and the amount is `280.00`. A `1.00` order is allowed only when `PAYPAL_TEST_CHECKOUT_ENABLED` is exactly `true` and the item name contains `TGT TEST ORDER`. Leave that flag off.
- `accessToken` trims the client id and secret. Trim does not repair a secret PayPal has already rejected.
- Local QA, mocked PayPal, no live call: `PASS` including the `$1` tamper case, which did not reach capture.

The ebook route is already in the Sites source: `src/App.jsx` renders `EbookLanding` for `/ai-made-simple` and `/ebook`. `scripts/build-sites-worker.mjs` lists both paths. `public/sitemap.xml` includes `/ai-made-simple`.

`tgttechnologies.com` is still the old bundle. This repo does not publish that host. Do not deploy LeaseSmart or Netlify and expect the cart to change.

## Single authorization still required

A signed-in owner session for ChatGPT Sites project `appgprj_6a8fb5d9596c8191a045ee1e5744fffd` must replace the stored Live `PAYPAL_CLIENT_SECRET` with the current secret from the same PayPal app as the public client id, then save and deploy this source. Do not paste the secret into chat, git, or this file. Do not retry git push, Codex login, or 1Password from this machine.
