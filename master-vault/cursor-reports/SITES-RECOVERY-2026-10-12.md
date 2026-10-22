# TGT website recovery — 2026-10-12

Correction: this work is the TGT Website, Sites project `appgprj_6a8fb5d9596c8191a045ee1e5744fffd`. It is not a LeaseSmart release. Do not install the cart into the LeaseSmart repository.

Project: TGT Website. Sites project `appgprj_6a8fb5d9596c8191a045ee1e5744fffd`.
Host: `https://tgttechnologies.com` (CNAME `custom-domains.chatgpt.site`).
Not a LeaseSmart or Netlify deploy. Command Center was not touched.
E-book sales: not activated. The manuscript was not edited.

| Check | Result |
|---|---|
| Source review | PASS for the prepared source. The browser-priced checkout was not kept. |
| Server price validation | PASS in local mocks |
| PayPal Sandbox transaction | NOT RUN. No sandbox credentials in this session. |
| Secure payment flow | NOT VERIFIED on PayPal. Live site still blocked. |
| Sites publication access | BLOCKED |
| Live deployment | NOT DEPLOYED |
| $280 checkout | BLOCKED |
| E-book page and sales | NOT PUBLISHED |

## Prepared checkout

The cart posts a product id or the existing laptop brand, plus email and ship-to. It does not post the price.

`sites-publication-2026-10-12/paypal.js`:

1. The server price for Lenovo, HP, and Other stays `280.00` USD.
2. A client `amount` that does not match that price returns HTTP 409 `amount_not_allowed` before PayPal is called.
3. `accessToken` trims the client id and secret. A trim does not repair a secret PayPal already rejected.
4. Capture loads the PayPal order first. It returns HTTP 409 `amount_not_allowed` and does not capture when the amount is not the server price. `1.00` is allowed only when `PAYPAL_TEST_CHECKOUT_ENABLED` is exactly `true` and the item name contains `TGT TEST ORDER`.
5. `PRODUCT_CATALOG` can add products, change a server price, or hide a product without another code build. `GET /api/paypal/products` lists only purchasable products.
6. `ebook-ai-made-simple` is hidden and returns HTTP 403 `product_unavailable`.

`worker-route.txt` is the one line to add in `scripts/build-sites-worker.mjs` for `/api/paypal/products`.

## Tests

`node master-vault/cursor-reports/sites-publication-2026-10-12/run-paypal-webhook-qa.mjs`

`PASS: PayPal Live API target, guarded $1 test checkout, capture amount lock, capture notification guard, signature verification, 2xx handling, and replay creates=0`

`node master-vault/cursor-reports/sites-publication-2026-10-12/paypal-flow.test.mjs`

| Case | Result |
|---|---|
| Client amount `1.00` | HTTP 409 before any PayPal call |
| Create laptop | `280.00` on the Sandbox-shaped host, approve URL returned |
| Approved order then capture | HTTP 200 `COMPLETED` on the stand-in |
| Looked-up amount `1.00` with the test flag off | HTTP 409 and capture was not called |
| E-book product | HTTP 403, PayPal not called |
| Catalog dock at `49.00` and a hidden product | Wrong client price rejected. Hidden product rejected. |

These stand-ins are not PayPal Sandbox. No sandbox client id or secret was available. Live `POST /api/paypal/create-order` was not sent.

## Sites publication — BLOCKED

Authorized path, existing project only:

1. An owner session already signed in to ChatGPT for `appgprj_6a8fb5d9596c8191a045ee1e5744fffd`.
2. Copy `paypal.js` to that project's `server/paypal.js`, add the products route, save a version, and deploy that version.
3. Replace `PAYPAL_CLIENT_SECRET` in that same Site with the Live secret from the PayPal app that owns the client id. Do not paste the secret into chat.

Not repeated: `git.chatgpt-team.site` username prompt, Codex CLI login, 1Password.

## Live site — NOT DEPLOYED

Read-only checks at `2026-10-12T02:05:36 GMT`. No PayPal POST.

- `GET https://tgttechnologies.com/` → HTTP 200, script `/assets/index-BkyY6VYH.js`. The HTML does not contain `ai-made-simple`.
- `GET https://tgttechnologies.com/ai-made-simple` with `Accept: text/plain` → HTTP 404, body `Not found`.

The live cart is still that old bundle. Payment processing is not verified until PayPal Sandbox, or the deployed site, completes create, buyer approval, and capture.
