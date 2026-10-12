# TGT website recovery — 2026-10-12

Project: TGT website, Sites `appgprj_6a8fb5d9596c8191a045ee1e5744fffd`
Branch: `cursor/website-paypal-brand-diagnosis-f434`
Live host: `https://tgttechnologies.com`
Deployment this session: none

## Scores

| Check | Result |
|---|---|
| Source review | PASS |
| Secure payment flow | FAIL |
| Sites publication access | BLOCKED |
| Live deployment | NOT DEPLOYED |
| $280 checkout | BLOCKED |
| AI Made Simple page | BLOCKED |

## Source review — PASS

The Sites source archive `tgt-site-cd885d5-source.tar.gz` contains the cart and the ebook route.

- `src/App.jsx` renders `EbookLanding` for `/ai-made-simple` and `/ebook`, and `PayPalCheckout` for `/cart`.
- `scripts/build-sites-worker.mjs` allowlists those routes.
- `server/paypal.js` sets `CHECKOUT_PRICE` to `280.00`. A client-supplied amount is ignored unless `testOrder` is true and `PAYPAL_TEST_CHECKOUT_ENABLED=true`.
- `src/components/PayPalCheckout.jsx` in that archive posts to `/api/paypal/create-order` and sends the buyer to the server `approveUrl`. Capture goes to `/api/paypal/capture-order`.

The browser SDK file previously stored on this branch called `actions.order.create` and `actions.order.capture` with the amount taken from the page. PayPal’s current Checkout guide creates and captures the order on the server. That browser file also sent line items without `amount.breakdown.item_total`, which PayPal rejects. It is not the publication cart. The publication cart is the server checkout UI now in `sites-paypal-sdk/PayPalCheckout.jsx`.

## Secure payment flow — FAIL

A local stand-in for PayPal, using the archived `server/paypal.js` plus the credential trim, did three things:

- Basic auth used the trimmed client id and secret (`live-client-id:live-client-secret`), not the padded values.
- The order body stayed `280.00` when the browser sent `amount: 1.00`.
- The handler returned an approve URL and did not capture.

That proves the unpublished server path. It does not prove a live charge. Loading `https://www.paypal.com/sdk/js` is not payment processing. No live capture was run.

`accessToken` in the archived source still does `btoa(\`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}\`)` with no trim. The trim is `sites-paypal-sdk/access-token-trim.patch`. Apply that patch to `server/paypal.js` in the iMac Sites checkout before the next save.

The publication copy `sites-publication-2026-10-12/paypal.js` already contains that trim and a capture guard. Capture loads the PayPal order first and returns `409 amount_not_allowed` unless the amount is `280.00` USD. A `1.00` order is allowed only when `PAYPAL_TEST_CHECKOUT_ENABLED` is exactly `true` and the item name contains `TGT TEST ORDER`. Use that file, not the trim patch alone. Local QA of that guard passed; it was a mocked PayPal, not a live charge.

## Live evidence — old bundle

Fetched 2026-10-12 without calling `POST /api/paypal/create-order`.

| Request | Result |
|---|---|
| `GET /cart` | HTTP 200, shell title `TGT Technologies Inc. — Your Outsourced IT Department`, assets `assets/index-BkyY6VYH.js` and `assets/index-CtG1yzy5.css` |
| `GET /assets/index-BkyY6VYH.js` | HTTP 200, 302960 bytes. Contains `$280.00` and `Pay $280.00 with PayPal`. Does not contain `ai-made-simple`, `/ebook`, or `www.paypal.com/sdk/js` |
| `GET /ai-made-simple` with no HTML accept | HTTP 404, body `Not found` |
| `GET /ai-made-simple` with `Accept: text/html` | HTTP 200, same homepage shell and same JS bundle |
| `GET /api/paypal/config` | HTTP 200, `environment: live`, `notificationsConfigured: true`, client id present |
| `GET /sitemap.xml` | `/`, `/privacy`, `/terms` only |

## Sites publication access — BLOCKED

The authorized save/deploy path is ChatGPT itself: open the existing Site, save a version, then deploy that version. Sites has no separate CLI deploy command. This machine has no signed-in ChatGPT Sites session and no self-hosted worker. Nothing was saved or deployed.

One action, from the Site owner, in ChatGPT web or the ChatGPT desktop app:

Open the existing Site for `appgprj_6a8fb5d9596c8191a045ee1e5744fffd`. Apply `access-token-trim.patch` to `server/paypal.js` in that Site’s source. Save a version, then deploy that saved version to `tgttechnologies.com`.

Do not create a new site. Do not deploy LeaseSmart, Netlify, or AppDeploy.

## Not repeated

No second `POST /api/paypal/create-order`. No Sites git username prompt. No 1Password login. No Codex login. No $1 capture. No Command Center edit.
