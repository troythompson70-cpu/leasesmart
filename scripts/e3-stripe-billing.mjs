/**
 * Sprint E3 — Stripe billing skeleton helpers (regression module)
 * TEST MODE only — no secret keys, no live charges.
 */
export const E3_TEST_PLAN_IDS = [
  'individual_standard',
  'individual_premium',
  'social_worker',
  'agency',
  'enterprise',
];

export const E3_FORBIDDEN_KEY_PATTERNS = [
  /sk_live_/,
  /sk_test_/,
  /rk_live_/,
  /rk_test_/,
  /pk_live_/,
];

export function e3IsTestPublishableKey(key) {
  if (!key || typeof key !== 'string') return false;
  if (key.indexOf('YOUR_') >= 0) return false;
  return key.indexOf('pk_test_') === 0;
}

export function e3ValidateNoSecretKeys(source) {
  const text = String(source || '');
  return !E3_FORBIDDEN_KEY_PATTERNS.some(function(re) { return re.test(text); });
}

export function e3GetPlanById(plans, planId) {
  if (!plans || !planId) return null;
  return plans.find(function(p) { return p.id === planId || p.stripePlanId === planId; }) || null;
}

export function e3ValidateMockInvoice(inv) {
  return !!(inv && inv.id && inv.amount && inv.status === 'demo_paid' && inv.testMode === true);
}
