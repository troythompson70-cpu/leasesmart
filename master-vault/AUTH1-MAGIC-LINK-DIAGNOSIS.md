# AUTH-1 — Magic Link Diagnosis & Redirect Checklist

**TGT Technologies Inc.** · Documentation only · Sprint AUTH-1

---

## First-line checks — do these before touching SMTP

Both checks below eliminate known-bad pointers that produce a "the magic link never
arrives" symptom without SMTP being involved at all. They rule causes **out**; neither one
reconstructs what broke a particular login attempt in the past.

### Check 1 — which project is the auth client actually using?

Auth config resolves from one of two places. `config.js` wins if it supplies **both** a URL
and an anon key; otherwise the `SUPABASE_URL` / `SUPABASE_ANON_KEY` constants in
`index.html` are used. Read the winner from the browser console after a login attempt:

```js
window.LS_SUPABASE_CONFIG_SOURCE   // 'config.js' or 'index.html'
```

If that is `undefined`, the client was never constructed — the login form's error text says
which of the two failed, and both lanes will fail before any email is requested.

A local `config.js` with a half-filled or placeholder value does not error; it falls through
to the `index.html` constants, so a login can succeed against a different project than the
one you were editing. That is the case to rule out when the wrong inbox gets the email.

Deployed hosts have no `config.js` at all — nothing generates it — so they always report
`index.html`. Confirming that from the outside needs a content-type check, because the
`_redirects` SPA rewrite answers missing files with `index.html` and a **200**:

```bash
curl -sI https://leasesmart.tgttechnologies.com/config.js | grep -i content-type
# text/html → not deployed (expected) · text/javascript → someone added one
```

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
| Session not detected after click | Wrong project — `config.js` override pointing elsewhere | Check `window.LS_SUPABASE_CONFIG_SOURCE` (see Check 1) |
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
