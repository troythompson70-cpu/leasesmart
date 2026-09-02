/**
 * LeaseSmart Supabase config — COPY to config.js locally (never commit config.js).
 * Use anon key ONLY. NEVER put service role key in any frontend file.
 *
 * This file is an OVERRIDE, not a requirement. No deploy generates config.js, so the
 * shipped app falls back to the SUPABASE_URL / SUPABASE_ANON_KEY constants in index.html —
 * which is also what the HUD gov_listings fetches read. Set supabaseUrl and supabaseAnonKey
 * here only to point a local checkout at a different project; both must be filled in for
 * the override to apply, otherwise auth uses the index.html constants.
 *
 * stripeTestPublishableKey has no fallback and is local-only by design, so test-mode
 * billing stays off on deployed hosts.
 */
window.LEASESMART_CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
  /** Stripe TEST publishable key only — set in local config.js (never commit). pk_test_* only. */
  stripeTestPublishableKey: "YOUR_STRIPE_TEST_PUBLISHABLE_KEY"
};
