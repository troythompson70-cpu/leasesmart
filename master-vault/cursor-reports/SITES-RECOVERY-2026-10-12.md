# TGT website recovery — 2026-10-12

Project: TGT Website. Sites project `appgprj_6a8fb5d9596c8191a045ee1e5744fffd`.
Host: `https://tgttechnologies.com` (CNAME `custom-domains.chatgpt.site`).
Not a LeaseSmart or Netlify deploy. Command Center was not touched.

| Check | Result |
|---|---|
| Source review | PASS for the prepared source. The earlier browser-SDK fallback failed review and was removed. |
| Secure payment flow | FAIL on the live site. Local amount lock PASS. No live capture was run. |
| Sites publication access | BLOCKED |
| Live deployment | NOT DEPLOYED |
| $280 checkout | BLOCKED |
| AI Made Simple page | BLOCKED |

## Source review — PASS

Reviewed `PayPalCheckout.jsx` and `server/paypal.js`.

The browser SDK fallback called `actions.order.create` with an amount taken from page state, then `actions.order.capture()`. That can open a PayPal button. It does not prove a $280 capture. A buyer can change the amount before PayPal creates the order, and the page would treat any `COMPLETED` capture as success. That path is not in the prepared checkout.

The prepared flow:

1. The cart posts brand, email, and ship-to to `/api/paypal/create-order`.
2. The server sets the amount to `280.00` USD. The buyer does not send the price.
3. On success the browser goes to PayPal’s `approveUrl`.
4. `/api/paypal/capture-order` loads that order and refuses it with `409 amount_not_allowed` unless the amount is `280.00` USD. `1.00` is accepted only when `PAYPAL_TEST_CHECKOUT_ENABLED` is exactly `true` and the item name contains `TGT TEST ORDER`.
5. Only then does the server capture.

`accessToken` trims the stored client id and secret before OAuth. A trim does not fix a secret PayPal already rejected.

Ebook source is present: `src/App.jsx` renders `EbookLanding` for `/ai-made-simple` and `/ebook`. The worker allowlist includes both. `public/sitemap.xml` lists `/ai-made-simple`.

Publication copies, SHA-256:

- `08ab4023831be5bd3e6f46f97c7848f3daaea6777429d63aa485eee1fcd1399f` `PayPalCheckout.jsx`
- `50ad721f30d52ad28c2d08b40b54be007fbaec78c4af8d38ea2da4d69f9eda2e` `paypal.js`
- `a27c5aa3c33046398963f1d4246ca82fde87065a261430e2e9535c4431691d79` `run-paypal-webhook-qa.mjs`
- `233babc854ebec12681ee352cceee1e4655e3614a8413a07610f51ce535e62a0` `src/App.jsx`
- `69fe640b2f38206721a04ae3302d7d084940ebc7d37a08a75f1b2bace634ea0d` `src/components/EbookLanding.jsx`
- `cba15ca6f8ab18f55d29a04b5526d9871a2c5643a9bf330f0edecf8683e1821c` `scripts/build-sites-worker.mjs`
- `c02857740c688f50c3dd1e465b2a9d15ac4307d7e94989488318579cd9514c28` `public/sitemap.xml`
- `f7b6ee6d4af16830d6f7da6cb1b95c0166c33dc633c47fdfd4c0fd5507a4e4f0` `.openai/hosting.json`

## Secure payment flow — FAIL live, local lock PASS

Local command, from the Sites source tree, mocked PayPal, no network:

`node qa/run-paypal-webhook-qa.mjs`

Result: `PASS: PayPal Live API target, guarded $1 test checkout, capture amount lock, capture notification guard, signature verification, 2xx handling, and replay creates=0`

The tamper case used an order whose PayPal amount was `1.00` while the test flag was off. Capture was not called. Response: HTTP 409 `amount_not_allowed`.

No live order was created and no live capture was attempted. The live worker still fails OAuth before it can create a server-priced order. That was already recorded. It was not called again.

## Sites publication access — BLOCKED

Authorized path, from the existing project only:

1. A Codex session already signed in as an owner of `appgprj_6a8fb5d9596c8191a045ee1e5744fffd`.
2. In that session, replace the Sites secret `PAYPAL_CLIENT_SECRET` with the current Live secret from the PayPal app that owns the client id already served by `GET /api/paypal/config`.
3. Save a version of this prepared source, then deploy that version.

This machine has no OpenAI, Codex, or Sites credential. These already failed and were not repeated: `git.chatgpt-team.site` username prompt, Codex CLI login, 1Password auth.

Single necessary action: use an existing owner Codex session for that Sites project to rotate the Live PayPal secret and save/deploy this source. Do not paste the secret into chat.

## Live deployment — NOT DEPLOYED

Read-only checks at `2026-10-12T02:05:36 GMT`. No PayPal POST.

- `GET https://tgttechnologies.com/` → HTTP 200, script `/assets/index-BkyY6VYH.js`. The HTML does not contain `ai-made-simple`.
- `GET https://tgttechnologies.com/ai-made-simple` with `Accept: text/plain` → HTTP 404, body `Not found`.

## $280 checkout — BLOCKED

The live cart is still the old bundle. Server create-order cannot return an approve URL while PayPal rejects the stored secret. The prepared server-priced checkout is not on that bundle.

## AI Made Simple — BLOCKED

The route exists in the prepared source and is absent from the live bundle. The 404 above is the route check. A browser `Accept: text/html` request can still show the homepage, because the live worker falls back to `index.html`. That 200 is not the ebook page.
