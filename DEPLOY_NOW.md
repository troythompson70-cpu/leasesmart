# Deploying LeaseSmart

**Live beta:** https://leasesmart.tgttechnologies.com

---

## How deployment happens

Pushing to `main` deploys to **Netlify**, which is the only deploy path. The custom domain
is a CNAME to `leasesmart2.netlify.app`, so the Netlify deploy log is the only thing that
tells you whether visitors have the new build.

The GitHub Pages mirror (`.github/workflows/pages.yml` plus the repo-root `CNAME`) was
retired — see `master-vault/DOMAIN-SETUP-GUIDE.md`. Do not re-add either without deciding
which host owns `leasesmart.tgttechnologies.com` first.

---

## Project structure (no separate CSS/JS)

| File | Required |
|------|----------|
| `index.html` | **YES — entire app (HTML + CSS + JS)** |
| `_redirects` | YES for Netlify SPA routing |
| `config.js` | Optional local override — gitignored, not generated for any deploy |
| `style.css` | **Does not exist** |
| `script.js` | **Does not exist** |

`_redirects` rewrites unmatched paths to `index.html` with a 200, so a request for a file
that is not deployed returns the app's HTML instead of a 404. Keep that in mind when
verifying that something shipped: check the content type, not just the status code.

Supabase auth reads the `SUPABASE_URL` / `SUPABASE_ANON_KEY` constants in `index.html` on
deployed hosts, and a local `config.js` overrides them only when it supplies both values.
Anon key only — a service role key must never reach a frontend file.

---

## Before you push

1. Bump `LS_BUILD` in `index.html` (see below) so caches break and the build is traceable.
2. Run the regression chain:

```bash
cd _qa
node sprint-c1pro-regression-test.mjs
```

That suite nests the earlier sprints, so a PASS covers the chain.

---

## Verify live (do not skip)

Open in a **private/incognito** window:

```
https://leasesmart.tgttechnologies.com
```

Then confirm the deployed build matches the repo:

```bash
curl -s https://leasesmart.tgttechnologies.com | grep -o "LS_BUILD = '[^']*'"
grep -o "LS_BUILD = '[^']*'" index.html
```

Both must print the same value. If the live one is older, Netlify has not finished or is
serving cache.

Also check the host is what you expect:

```bash
curl -sI https://leasesmart.tgttechnologies.com | grep -i server   # expect: Netlify
dig leasesmart.tgttechnologies.com CNAME +short                     # expect: leasesmart2.netlify.app
```

To check whether a specific file is actually deployed, look at the content type — the SPA
rewrite makes a missing file return the app HTML with a 200:

```bash
curl -sI https://leasesmart.tgttechnologies.com/config.js | grep -i content-type
# text/javascript = deployed · text/html = NOT deployed (rewritten to index.html)
```

---

## Build ID

`index.html` defines the build once:

```js
var LS_BUILD = '20260530-v2.14.0-data-a1';
```

The page title, beta banner, and version footers are all derived from `LS_BUILD` at init,
so bumping this one string updates every visible version label. Format is
`YYYYMMDD-vMAJOR.MINOR.PATCH-slug`; `_qa/build-id-lib.mjs` parses and orders it, and the
regression suites assert the shipped build is no older than the sprint they cover.

---

## Notes

- Never commit `config.js`, API keys, or Supabase service role keys.
- Draft SQL in `supabase/drafts/` must not be applied without explicit approval.
- Billing (E3) is test mode only; legal (E2) is draft pending attorney review.
