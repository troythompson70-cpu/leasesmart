/**
 * LeaseSmart Supabase config — COPY to config.js locally (never commit config.js).
 * Use anon key ONLY. NEVER put service role key in any frontend file.
 */
window.LEASESMART_CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
  /** Stripe TEST publishable key only — set in local config.js (never commit). pk_test_* only. */
  stripeTestPublishableKey: "YOUR_STRIPE_TEST_PUBLISHABLE_KEY"
};
