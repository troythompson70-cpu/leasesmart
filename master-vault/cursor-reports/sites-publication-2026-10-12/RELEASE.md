# TGT Website installable release

Project: TGT Website
Sites project: `appgprj_6a8fb5d9596c8191a045ee1e5744fffd`
Live host: `https://tgttechnologies.com`
This folder is not a LeaseSmart deploy.

## Install

From the existing TGT Website checkout (the folder whose `.openai/hosting.json` contains that project id):

```bash
bash master-vault/cursor-reports/sites-publication-2026-10-12/install.sh /path/to/tgt-site
```

The script stops if `project_id` is missing or different. It stopped on this LeaseSmart workspace because `/workspace` has no `.openai/hosting.json`.

It copies `paypal.js` to `server/paypal.js`, copies `PayPalCheckout.jsx` only when that cart file already exists, and adds the `/api/paypal/products` route to `scripts/build-sites-worker.mjs`. It does not copy the e-book and does not turn on e-book sales.

## Deployment route

Confirmed from the ChatGPT Sites guide:

1. Open the existing Site in ChatGPT on the web (More > Sites) or in the ChatGPT desktop app.
2. Save a version of this checkout.
3. Deploy that saved version.

Codex CLI and the IDE extension do not publish a Site. This Cursor session is the LeaseSmart git checkout, not that Site. It cannot open the owner editor. Git username login, Codex login, and 1Password were not retried.

Until an owner ChatGPT session accepts this checkout, commits in this repository do not change `tgttechnologies.com`.

## Payment verification

Not verified on PayPal. No sandbox credential was available, and the live create-order path was not called.

Local stand-ins passed:

- `node master-vault/cursor-reports/sites-publication-2026-10-12/run-paypal-webhook-qa.mjs`
- `node master-vault/cursor-reports/sites-publication-2026-10-12/paypal-flow.test.mjs`

A client amount of `1.00` is refused before PayPal. Capture of a non-server amount is refused before capture. That is not a completed PayPal payment.
