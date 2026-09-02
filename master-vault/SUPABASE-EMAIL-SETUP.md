# Supabase Email Setup — LeaseSmart Beta Magic Links

**TGT Technologies Inc.** · Documentation only  
**Applied by:** Troy Thompson / admin in Supabase Dashboard — **not by Cursor**

---

## Why this matters

LeaseSmart should **not** depend on a generic Supabase sender for login emails when TGT already owns the domain and business email.

| Layer | Who owns it |
|-------|-------------|
| **Domain / email identity** | TGT — `tgttechnologies.com`, `leasesmart@tgttechnologies.com` |
| **Login token / magic link** | Supabase Auth (generates `{{ .ConfirmationURL }}`) |
| **Email delivery engine** | Custom SMTP connected to TGT mailbox (GoDaddy / Microsoft 365) |

**Plain English:** Supabase creates the secure login link. **Your branded SMTP sends the email** so users see LeaseSmart/TGT — not a generic Supabase sender.

**Benefits:**
- Branded sender (**LeaseSmart Beta**)
- Higher trust, less user confusion
- Fewer Supabase free-tier email rate limits during beta testing
- Professional beta experience
- Reply goes to `leasesmart@tgttechnologies.com`

---

## Target sender identity

| Field | Value |
|-------|--------|
| **From name** | LeaseSmart Beta |
| **From email** | `leasesmart@tgttechnologies.com` |
| **Reply-to** | `leasesmart@tgttechnologies.com` |
| **Subject** | Your LeaseSmart Beta Magic Link |

Frontend **cannot** fake this. Configure in Supabase Dashboard only.

---

## Recommended path (Option A first)

### Option A — GoDaddy / Microsoft 365 SMTP (preferred)

Use the existing TGT mailbox. Keeps everything under your domain.

1. Create or confirm mailbox: `leasesmart@tgttechnologies.com` (GoDaddy or Microsoft 365).
2. Connect Supabase Auth custom SMTP to that mailbox (steps below).
3. Test **one** magic link.
4. Avoid repeated resend clicks during testing (rate limits).

### Option B — Resend / SendGrid (fallback only)

Use only if GoDaddy/Microsoft SMTP is hard to connect, rate-limited, or deliverability fails. Same sender identity rules apply.

---

## What Troy needs from GoDaddy / Microsoft (placeholders only)

Gather these from GoDaddy email settings or Microsoft 365 admin. **Enter values only in Supabase Dashboard — never in code, chat, or git.**

| Item | Placeholder / typical value |
|------|-----------------------------|
| SMTP host | `[FROM GODADDY OR MICROSOFT EMAIL SETTINGS]` e.g. `smtp.office365.com` |
| SMTP port | Usually **587** (TLS) |
| SMTP username | `leasesmart@tgttechnologies.com` |
| SMTP password | `[ENTER ONLY IN SUPABASE DASHBOARD — DO NOT COMMIT]` |
| Sender name | LeaseSmart Beta |
| Sender email | `leasesmart@tgttechnologies.com` |
| Reply-to | `leasesmart@tgttechnologies.com` |

### Do NOT paste into ChatGPT, Claude, Cursor, or GitHub

- GoDaddy password  
- Microsoft email password  
- SMTP password / app password  
- DNS account login  
- Supabase service role key  

Enter secrets **only** in: **Supabase Dashboard → Project → Authentication → SMTP Settings**

---

## Step 1 — Supabase Dashboard → SMTP Settings

1. Go to [Supabase Dashboard](https://supabase.com/dashboard).
2. Select the project the deployed app authenticates against: **`iajaftjnfxrywqgccdef`**.
   SMTP configured on any other project will not send LeaseSmart login emails.
   Confirm the ref before changing anything:

   ```bash
   curl -s https://leasesmart.tgttechnologies.com/config.js | grep -o 'https://[a-z0-9]*\.supabase\.co'
   ```
3. Navigate to **Project Settings** → **Authentication** → **SMTP Settings** (or **Authentication** → **SMTP**).
4. Enable **Custom SMTP**.
5. Fill in (placeholders above — real password only in dashboard):

   | Supabase field | Value |
   |----------------|--------|
   | SMTP Host | `[FROM GODADDY/MICROSOFT]` |
   | SMTP Port | `587` |
   | SMTP User | `leasesmart@tgttechnologies.com` |
   | SMTP Password | `[DASHBOARD ONLY — DO NOT COMMIT]` |
   | Sender name | `LeaseSmart Beta` |
   | Sender email | `leasesmart@tgttechnologies.com` |
   | Reply-to (if field exists) | `leasesmart@tgttechnologies.com` |

6. Save. Use dashboard **Send test email** if available.

---

## Step 2 — Email template (Magic Link)

1. **Authentication** → **Email Templates** → **Magic Link**.
2. Set **Subject**:

   ```
   Your LeaseSmart Beta Magic Link
   ```

3. Set **Body** (keep `{{ .ConfirmationURL }}` — Supabase replaces it with the real link):

   ```html
   <p>Welcome to LeaseSmart Beta.</p>
   <p>Click the secure magic link below to sign in:</p>
   <p><a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a></p>
   <p>No password is needed. This link signs you in safely.</p>
   <p>For best results, open this email on the same device you used to request the link.</p>
   <p>If you did not request this email, you can ignore it.</p>
   <p>Need help signing in?<br/>Email us at <a href="mailto:leasesmart@tgttechnologies.com">leasesmart@tgttechnologies.com</a>.</p>
   <p>LeaseSmart by TGT Technologies Inc.</p>
   ```

4. Save.

---

## Step 3 — DNS: SPF / DKIM / DMARC (GoDaddy)

Sending from `@tgttechnologies.com` requires correct DNS. **Do not change MX records unless you know you must** — changing MX can break existing business email.

| Record | Purpose | Notes |
|--------|---------|--------|
| **SPF** | Authorize sending servers | Add/include Microsoft or GoDaddy outbound servers per provider docs |
| **DKIM** | Sign outbound mail | Enable in Microsoft 365 / GoDaddy; publish CNAME/TXT they provide |
| **DMARC** (recommended) | Policy + reporting | Example: `v=DMARC1; p=none; rua=mailto:leasesmart@tgttechnologies.com` |

**Warnings:**
- Verify SPF/DKIM/DMARC at GoDaddy DNS for `tgttechnologies.com` before heavy testing.
- Do **not** remove existing MX records for Microsoft 365 unless migrating mail.
- Propagation: 15 minutes–48 hours. Check [dnschecker.org](https://dnschecker.org).

---

## Step 4 — Redirect URLs (magic link return)

Supabase still generates the token; the link must return to your app.

1. **Authentication** → **URL Configuration**.
2. **Site URL:** your deployed app URL.
3. **Redirect URLs** allow-list:

   ```
   https://troythompson70-cpu.github.io/leasesmart/*
   https://leasesmart.tgttechnologies.com/*
   http://localhost:*
   ```

LeaseSmart uses `?v=BUILD_ID&beta=magic` on return — wildcards above cover this.

---

## Step 5 — Test (one email only)

1. Open LeaseSmart → **Sign Up** or **Log In**.
2. Request **one** magic link (avoid resend spam during setup).
3. Confirm inbox shows:
   - **From:** LeaseSmart Beta `<leasesmart@tgttechnologies.com>`
   - **Subject:** Your LeaseSmart Beta Magic Link
4. Open link on the **same device** → app should complete auth → onboarding or dashboard.

If rate-limited: wait, fix SMTP, then retest once — do not hammer Resend.

---

## App-side cooldown (already in LeaseSmart)

Sprint D4 rate limiting applies to `auth_magic_link` API calls. After SMTP is live, still avoid rapid resend clicks during beta testing.

Support in app (A7): **Get Help** → `mailto:leasesmart@tgttechnologies.com` with subject **LeaseSmart Beta Login Help**.

---

## Security checklist

- [ ] No SMTP password in `index.html`, `config.js`, `.env` committed files, or GitHub  
- [ ] No SMTP credentials in AI chats  
- [ ] Anon key only in frontend (`config.js`, gitignored)  
- [ ] Service role key never in frontend  
- [ ] This doc uses placeholders only  

---

## Manual steps summary (Troy)

1. Confirm `leasesmart@tgttechnologies.com` mailbox exists (GoDaddy / M365).  
2. Supabase → Authentication → **Enable custom SMTP** with GoDaddy/M365 settings.  
3. Supabase → Email Templates → Magic Link subject + body (above).  
4. GoDaddy DNS → verify SPF/DKIM/DMARC; **do not break MX**.  
5. Supabase → URL Configuration → redirect allow-list.  
6. Test **one** magic link.  
7. Add Resend/SendGrid only if Option A fails.

---

## Reference

- [Supabase Auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- LeaseSmart app support: `leasesmart@tgttechnologies.com`
