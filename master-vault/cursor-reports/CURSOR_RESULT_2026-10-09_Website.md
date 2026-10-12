# CURSOR RESULT — Website: PayPal live, 404, one brand

Date: 2026-10-12
Order: `CURSOR_ORDER_2026-10-09_Website_PayPal_Brand.md`
Project checked: LeaseSmart `tgt-website` on `origin/main` (`a85dc05`) and the OpenAI Sites release archive `tgt-site-cd885d5-source.tar.gz`
Command Center: not modified
Deployment: not deployed

## 1. PayPal LIVE checkout — BLOCKED

Live `GET /api/paypal/config` returns HTTP 200. The route is configured, not 503.

- `environment`: `live`
- `notificationsConfigured`: `true`
- `PAYPAL_CLIENT_ID`: present (value not recorded)
- `PAYPAL_CLIENT_SECRET`: present as a Sites secret (value not read)

One `POST /api/paypal/create-order` with `testOrder: true`, brand `Lenovo`, and a complete US ship-to returned HTTP 502 `{"ok":false,"error":"paypal_auth_failed"}`. PayPal rejected the stored Live client secret before an order id existed. No capture, no refund, no second attempt.

`cd885d5` is not the live worker. That release is the one that returns `403 test_checkout_disabled` unless `PAYPAL_TEST_CHECKOUT_ENABLED=true`. The live worker reached PayPal OAuth instead, so the $1 guard is not what production is running. Do not enable the test flag, and do not retry a successful create, until `cd885d5` is the deployed worker. A successful auth on the current worker would open a $280 order.

Public cart proof (rendered, not charged): `https://tgttechnologies.com/cart` shows **$280.00** and the button **Pay $280.00 with PayPal**. Screenshot: `/opt/cursor/artifacts/cart-paypal-button.png`.

Owner unblock: Troy replaces `PAYPAL_CLIENT_SECRET` in the OpenAI Sites environment for project `appgprj_6a8fb5d9596c8191a045ee1e5744fffd`. Keep `PAYPAL_ENV=live` and `PAYPAL_ENVIRONMENT=live`. Use the secret from the same PayPal Live app as the stored client id. Do not paste the secret into chat. Reply `done` after it is saved. This agent did not open or change that screen.

## 2. Publish `cd885d5` / `/ai-made-simple` — FAIL (not deployed)

Release commit required by the handoff: `cd885d5d5db2f84268e43bb71c51c14ac4666b68` (`Add AI Made Simple launch page and guarded PayPal test checkout`).

That commit is not in the LeaseSmart GitHub history. It is archived in OneDrive as `tgt-site-cd885d5-source.tar.gz`. In that source, `scripts/build-sites-worker.mjs` allowlists `/ai-made-simple` and `/ebook`, and `src/App.jsx` renders `EbookLanding` there.

Live behavior on 2026-10-12:

| Request | Result |
|---|---|
| `/ai-made-simple` with no `Accept: text/html` | HTTP 404, body `Not found` |
| `/ai-made-simple` desktop Chrome `Accept: text/html` | HTTP 200 shell, rendered homepage |
| `/ai-made-simple` iPhone Safari `Accept: text/html` | HTTP 200 shell, rendered homepage |
| `/ebook`, `/cart-test` with `Accept: text/html` | HTTP 200 shell, same fallback |
| `/sitemap.xml` | `/`, `/privacy`, `/terms` only. No `/ai-made-simple` |

The live bundle `assets/index-BkyY6VYH.js` does not contain `ai-made-simple`. Browser 200s are the worker HTML fallback serving the homepage, not the ebook page. Nav has no Ebook link. Screenshots: `/opt/cursor/artifacts/ai-made-simple-desktop.png`, `/opt/cursor/artifacts/ai-made-simple-phone.png`.

Publish blocker: `git.chatgpt-team.site` resolves from this VM, but `git ls-remote` on `https://git.chatgpt-team.site/5c275419-ed9a-4d7f-8832-b66e9c2b9150/appgprj_6a8fb5d9596c8191a045ee1e5744fffd.git` stopped with `could not read Username`. No Sites credential is available here, and the iMac checkout `/Users/t-imac/Documents/Codex/2026-09-26/referenced-chatgpt-conversation-this-is-an-3/work/tgt-site` is not on this machine. Nothing was pushed. Nothing was saved as a Sites version.

LeaseSmart `origin/main` is not the site that serves `tgttechnologies.com`. Live `<title>` is `Your Outsourced IT Department`. LeaseSmart `tgt-website/index.html` title is `Tech Made Simple. AI Made Useful.` Publishing LeaseSmart would not ship this page.

## 3. One brand — FAIL (not changed)

Live CSS `assets/index-CtG1yzy5.css` contains navy `#0A1628`. It does not contain `#1565ff` or `#4da3ff`. The `cd885d5` Tailwind brand blue is `#1E5BB8` / `#2F74D8`. The logo artwork reads `TECH • GROWTH • TRUST`. The phrase `Real People. Real Solutions.` is not in the live JavaScript. Assessment and TGT Tips email templates were not rebuilt. No mail was sent.

## 4. Booking form — BLOCKED

Live booking control points at Microsoft Bookings: `https://bookings.cloud.microsoft/book/TGTTECHNOLOGIESINC`. This run did not submit a booking and did not POST `https://tgttechnologies.com/api/intake`. Either action would create live mailbox traffic. No Power Automate run id was produced.

## Files changed

- `master-vault/cursor-reports/CURSOR_RESULT_2026-10-09_Website.md` (this report)
- OneDrive copy: `TGT Executive Command/AI Made Simple Launch/06 ChatGPT Codex Project Records/CURSOR_RESULT_2026-10-09_Website.md`

No website source, PayPal secret, Command Center file, or hosting environment was edited.

## Tests

Live route and PayPal probes above. No LeaseSmart unit suite was required because application code was not changed. No production deploy was run.
