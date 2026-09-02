# AUTH-1 — Magic Link Diagnosis & Redirect Checklist

**TGT Technologies Inc.** · Documentation only · Sprint AUTH-1

---

## First-line checks — do these before touching SMTP

Both checks below eliminate known-bad pointers that produce a "the magic link never
arrives" symptom without SMTP being involved at all. They rule causes **out**; neither one
reconstructs what broke a particular login attempt in the past.

### Check 1 — is `config.js` actually reaching the browser?

`index.html` loads auth config with `<script src="config.js"></script>`, and `config.js` is
gitignored. If it is not present on the deployed host, `window.LEASESMART_CONFIG` stays
null, the Supabase client is never constructed, and **both** lanes fail before any email is
requested. The UI reports "Supabase is not configured" rather than an email failure.

On Netlify this is easy to miss: `_redirects` rewrites unmatched paths to `index.html` with
a **200**, so a missing `config.js` returns the whole app as HTML instead of a 404. Check
the content type, not the status:

```bash
curl -sI https://leasesmart.tgttechnologies.com/config.js | grep -i content-type
# text/javascript → deployed · text/html → NOT deployed (rewritten to index.html)
```

Locally, confirm the file exists at the repo root next to `index.html`.

### Check 2 — does the configured project ref exist?

Three project refs have appeared across this repo. Only one resolves:

| Ref | Where it came from | Resolves? |
|-----|--------------------|-----------|
| `iajaftjnfxrywqgccdef` | `SUPABASE_URL` in `index.html` — what the shipped app uses | **Yes** — `/auth/v1/health` returns 401 with a Supabase error envelope |
| `wsxsnbgvbrebbusgokmp` | `SUPABASE_URL` repo secret, baked into the retired Pages `config.js` | No — no DNS record |
| `jufxyuqcgijaiuyratlp` | Earlier copy of `SUPABASE-EMAIL-SETUP.md` | No — no DNS record |

```bash
node scripts/supabase-live-probe.mjs   # reachability + auth settings + anon table access
```

Configuring SMTP on a ref that does not resolve looks exactly like SMTP being broken, so a
doc or secret pointing at a dead ref is a **contributing** cause worth eliminating first.
It is not evidence that this is what previously blocked the lane: a non-resolving ref today
does not distinguish a typo from a project that was deleted after being used correctly.

Full evidence for both checks: `master-vault/cursor-reports/LIVE-INFRA-PROBE-2026-09-02.md`.

---

## Common failure causes (consumer lane)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Magic link opens blank / home only | Redirect URL not in Supabase allow-list | Add `http://localhost:8080/*` and production URL |
| Session not detected after click | `config.js` missing or wrong anon key | Copy from `config.example.js` |
| Link opens wrong device | Magic link is device/session sensitive | Open on same browser that requested link |
| `#access_token` in URL but no login | `getSession()` not called after redirect | Fixed in AUTH-1: `auth1ProcessAuthRedirect()` |
| `?code=` in URL stays visible | PKCE callback not exchanged | Supabase client `detectSessionInUrl: true` + strip URL after |
| ERR_CONNECTION_REFUSED | Local server not running | `python3 -m http.server 8080` in repo folder |

---

## Supabase Dashboard checks

1. **Authentication → URL Configuration**
   - Site URL: deployed app or `http://localhost:8080`
   - Redirect URLs:
     ```
     http://localhost:8080/*
     https://leasesmart.tgttechnologies.com/*
     ```
   - The `troythompson70-cpu.github.io/leasesmart/*` entry can be removed — the Pages
     mirror is retired.

2. **Authentication → Providers → Email**
   - Magic link / OTP enabled (consumer lane)
   - Confirm email: OFF for internal test (optional)

3. **Email templates** — see `SUPABASE-EMAIL-SETUP.md`

---

## AUTH-1 lane split

| Lane | Auth method | Public signup |
|------|-------------|---------------|
| **Consumer (Renter)** | Magic link (`signInWithOtp`) | Yes — beta signup |
| **Case Manager (Pro)** | Email/password (`signInWithPassword`) | **No** — admin-provisioned only |

Pro lane does **not** use magic link signup. Invites use Supabase invite/recovery flows when live.

---

## Token cleanup (required)

After auth callback, app calls `auth1StripAuthTokensFromUrl()` to remove:
- `code`, `token`, `type`, `access_token`, `refresh_token` from query/hash

Tokens must not remain in URL bar, history, or localStorage.

---

## Troy recording checklist

When sending login failure recording, include:
1. Exact URL opened (`localhost` vs `leasesmart.tgttechnologies.com`)
2. Button clicked (Sign Up / Log In / Case Manager Login)
3. Error message text
4. Browser console errors (screenshot)
5. Whether `config.js` exists locally
