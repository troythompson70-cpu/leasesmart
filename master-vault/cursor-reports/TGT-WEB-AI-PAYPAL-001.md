# TGT-WEB-AI-PAYPAL-001 — access check

Date: 2026-10-17
Project: TGT Website
Sites project: `appgprj_6a8fb5d9596c8191a045ee1e5744fffd`
Live host: `https://tgttechnologies.com`
This is not a LeaseSmart deploy.

## Access

| Check | Result |
|---|---|
| OpenAI Sites editor for `appgprj_6a8fb5d9596c8191a045ee1e5744fffd` | NO. This workspace has no `.openai/hosting.json` and no Sites credential. ChatGPT Sites is the only deploy path, and it was not opened. |
| PayPal sandbox client id and secret | NO. No PayPal environment variables are set. |
| OpenAI API key | NO. No OpenAI environment variables are set. |
| Supabase or other database connector | NO. No Supabase MCP. Turso is listed and needs authentication. It was not connected. |
| 1Password | Unavailable. The connector failed tool discovery. The vault was not opened. |

Ready connectors in this session do not host the TGT Website or PayPal. They include Outlook, OneDrive, Google Calendar, Airtable, and others. None of them can save or deploy the Sites project.

## Live site

`GET https://tgttechnologies.com/` on 2026-10-17 returned HTTP 200 and `assets/index-BkyY6VYH.js`. That is still the old bundle. No PayPal order was created.

## What was not done

- PayPal code was not deployed.
- PayPal Sandbox was not called.
- OpenAI service code was not written. The service, the product that unlocks it, the limits, and the fulfillment method are not defined.
- No payment table was created.
- The e-book was not published and its sales stay off.
- Git username login, Codex login, and 1Password were not retried.

## Local tests, still mocks

`paypal-flow.test.mjs`: 7 PASS.
`run-paypal-webhook-qa.mjs`: PASS.
These do not prove a PayPal payment.

## What Troy does after ChatGPT is open

1. On the existing TGT Website checkout, run `bash master-vault/cursor-reports/sites-publication-2026-10-12/install.sh /path/to/tgt-site`.
2. In ChatGPT, open the existing Site `appgprj_6a8fb5d9596c8191a045ee1e5744fffd`. Do not create a new site.
3. Save a version, then deploy that version to `tgttechnologies.com`.
4. Put the PayPal Live secret in that Site's settings. Do not paste it into chat.

PayPal Sandbox verification still needs a sandbox client id and secret supplied outside chat. OpenAI work waits until the service, the unlocking product, the limits, and the fulfillment method are defined.
