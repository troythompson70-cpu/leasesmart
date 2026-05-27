# Supabase Email Setup — LeaseSmart Beta Magic Links

**TGT Technologies Inc.** · Sprint A7 documentation only  
**Do not apply in Cursor** — Troy or admin applies in Supabase Dashboard.

---

## Goals

| Setting | Target value |
|---------|----------------|
| Sender display name | **LeaseSmart Beta** |
| Reply / support email | **leasesmart@tgttechnologies.com** |
| Magic link subject | **Your LeaseSmart Beta Magic Link** |

Frontend cannot fake sender branding. These changes require Supabase Auth email configuration.

---

## Step 1 — Open Supabase Auth settings

1. Go to [Supabase Dashboard](https://supabase.com/dashboard).
2. Select project: **jufxyuqcgijaiuyratlp** (LeaseSmart).
3. Navigate to **Authentication** → **Email Templates**.

---

## Step 2 — Edit Magic Link template

1. Open template: **Magic Link** (also used for OTP / sign-in links).
2. Set **Subject** to:

   ```
   Your LeaseSmart Beta Magic Link
   ```

3. Update email body copy (example — keep `{{ .ConfirmationURL }}` placeholder):

   ```html
   <h2>LeaseSmart Beta</h2>
   <p>Tap the button below to sign in to LeaseSmart Beta. This link expires soon and works on the device where you requested it.</p>
   <p><a href="{{ .ConfirmationURL }}">Sign in to LeaseSmart Beta</a></p>
   <p>No password needed. If you did not request this email, ignore it.</p>
   <p>Need help? Reply to leasesmart@tgttechnologies.com</p>
   ```

4. Click **Save**.

---

## Step 3 — Configure SMTP (custom sender)

Default Supabase mail comes from `noreply@mail.app.supabase.io`. For **LeaseSmart Beta** display name and **leasesmart@tgttechnologies.com** reply routing:

1. Go to **Project Settings** → **Authentication** → **SMTP Settings**.
2. Enable **Custom SMTP**.
3. Use your provider (GoDaddy, SendGrid, Resend, etc.). Example fields:

   | Field | Example |
   |-------|---------|
   | Host | `smtp.office365.com` or provider host |
   | Port | `587` (TLS) |
   | Username | mailbox or API user |
   | Password | app password (never commit) |
   | Sender email | `leasesmart@tgttechnologies.com` |
   | Sender name | `LeaseSmart Beta` |

4. Save and send a **test email** from the dashboard.

---

## Step 4 — DNS records (GoDaddy / Microsoft 365)

If sending from `leasesmart@tgttechnologies.com`, add provider-required records at GoDaddy:

- **SPF** — authorize sending server
- **DKIM** — signing key from SMTP provider
- **DMARC** (recommended) — `v=DMARC1; p=none; rua=mailto:leasesmart@tgttechnologies.com`

Wait 15 minutes–48 hours for DNS propagation. Use [dnschecker.org](https://dnschecker.org) to verify.

---

## Step 5 — Redirect URLs (magic link return)

1. **Authentication** → **URL Configuration**.
2. Confirm **Site URL** matches your deployed app (e.g. GitHub Pages or custom domain).
3. Add redirect allow-list entries:

   ```
   https://troythompson70-cpu.github.io/leasesmart/*
   https://leasesmart.tgttechnologies.com/*
   http://localhost:*
   ```

4. LeaseSmart app redirect includes `?v=BUILD_ID&beta=magic` — wildcard path above covers this.

---

## Step 6 — Verify end-to-end

1. Open LeaseSmart → **Sign Up** or **Log In**.
2. Request magic link.
3. Confirm email shows:
   - From: **LeaseSmart Beta** `<leasesmart@tgttechnologies.com>` (after SMTP)
   - Subject: **Your LeaseSmart Beta Magic Link**
4. Tap link → returns to app → onboarding or dashboard per user state.

---

## Security notes

- Never put **service role key** or SMTP password in `index.html`, `config.js`, or git.
- Anon key only in frontend (`config.js`, gitignored).
- Support flow in app uses `mailto:leasesmart@tgttechnologies.com` — no third-party helpdesk in A7.

---

## Reference

- [Supabase Auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
