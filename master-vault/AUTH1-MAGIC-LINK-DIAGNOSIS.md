# AUTH-1 — Magic Link Diagnosis & Redirect Checklist

**TGT Technologies Inc.** · Documentation only · Sprint AUTH-1

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
     https://troythompson70-cpu.github.io/leasesmart/*
     https://leasesmart.tgttechnologies.com/*
     ```

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
1. Exact URL opened (local vs GitHub Pages vs custom domain)
2. Button clicked (Sign Up / Log In / Case Manager Login)
3. Error message text
4. Browser console errors (screenshot)
5. Whether `config.js` exists locally
