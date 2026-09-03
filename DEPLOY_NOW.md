# Deploying LeaseSmart

**Live beta:** https://leasesmart.tgttechnologies.com

---

## How deployment happens

Pushing to `main` triggers two independent deploys of the same repo:

| Target | Trigger | Serves |
|--------|---------|--------|
| **Netlify** | Push to `main` | `leasesmart.tgttechnologies.com` (the live beta) |
| **GitHub Pages** | `.github/workflows/pages.yml` | `troythompson70-cpu.github.io/leasesmart` (mirror) |

The custom domain is a CNAME to `leasesmart2.netlify.app`, so **Netlify is what visitors
hit**. A green Pages workflow does not prove the custom domain updated — check the Netlify
deploy log too.

---

## Project structure (no separate CSS/JS)

| File | Required |
|------|----------|
| `index.html` | **YES — entire app (HTML + CSS + JS)** |
| `_redirects` | YES for Netlify SPA routing |
| `CNAME` | Read by GitHub Pages for its custom domain |
| `config.js` | Generated at deploy from repo secrets — never committed |
| `style.css` | **Does not exist** |
| `script.js` | **Does not exist** |

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
