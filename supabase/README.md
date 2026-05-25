# LeaseSmart Supabase — Sprint A1

## Apply migration

**Approval required:** Do not apply RLS migration to production without Troy's sign-off. Preview in SQL Editor first (read-only verification queries below).

1. Create a Supabase project (internal testing only).
2. Run `migrations/20260523100000_sprint_a1_foundation.sql` in the SQL Editor.
3. Enable **Email** auth in Supabase Dashboard → Authentication.
4. Enable **Magic Link** (OTP) sign-in. **Disable password sign-in** for beta testers — LeaseSmart is magic-link only.
5. Copy `config.example.js` to `config.js` (gitignored) with **anon key only**:
   ```javascript
   window.LEASESMART_CONFIG = {
     supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
     supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY"
   };
   ```
   Or copy `.env.example` to `.env` and run `node scripts/generate-config.mjs`.
6. Never commit `config.js` or any service role key.
7. For GitHub Pages beta auth: add repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then set Pages source to **GitHub Actions** (workflow: `.github/workflows/pages.yml`).

## Verify RLS (read-only)

Run in SQL Editor after migration — no writes:

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public' ORDER BY tablename, policyname;
```

## Security

- RLS enabled on all 11 tables.
- Beta auth: **magic link only** — no password UI or `signInWithPassword` in frontend.
- Service role operations are server-side only (future Edge Functions / admin tools).
- Frontend uses anon key + RLS only.
