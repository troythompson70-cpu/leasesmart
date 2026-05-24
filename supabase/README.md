# LeaseSmart Supabase — Sprint A1

## Apply migration

1. Create a Supabase project (internal testing only).
2. Run `migrations/20260523100000_sprint_a1_foundation.sql` in the SQL Editor.
3. Enable Email auth in Supabase Dashboard → Authentication.
4. Copy `config.example.js` to `config.js` (gitignored) with **anon key only**.
5. Never commit `config.js` or any service role key.

## Security

- RLS enabled on all 11 tables.
- Service role operations are server-side only (future Edge Functions / admin tools).
- Frontend uses anon key + RLS only.
