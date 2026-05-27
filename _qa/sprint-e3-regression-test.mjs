/**
 * Sprint E3 — Stripe billing skeleton + E2 nested chain
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  E3_TEST_PLAN_IDS,
  e3IsTestPublishableKey,
  e3ValidateNoSecretKeys,
  e3GetPlanById,
  e3ValidateMockInvoice,
} from '../scripts/e3-stripe-billing.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260526-v2.2.0-e3';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sql = readFileSync(join(ROOT, 'supabase/drafts/sprint_e3_billing.sql'), 'utf8');
const seed = readFileSync(join(ROOT, '_data/sprint-e3-mock-seed.js'), 'utf8');
const configExample = readFileSync(join(ROOT, 'config.example.js'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('E3 build id', html.includes("LS_BUILD = '" + BUILD + "'"));
assert('E3 mock seed linked', html.includes('sprint-e3-mock-seed.js'));
assert('E3 draft SQL', sql.includes('DRAFT ONLY') && sql.includes('billing_subscriptions'));
assert('E3 test_mode column', sql.includes('test_mode'));

// Agent 1 — pricing page
assert('e3-pricing-pg', html.includes('id="e3-pricing-pg"'));
assert('Free tier', html.includes('Free') && seed.includes("'free'"));
assert('Standard $9.99', seed.includes('$9.99') && seed.includes('individual_standard'));
assert('Premium $19.99', seed.includes('$19.99') && seed.includes('individual_premium'));
assert('Social Worker $49', seed.includes('$49') && seed.includes('social_worker'));
assert('Agency $199', seed.includes('$199') && seed.includes('agency'));
assert('Enterprise $999', seed.includes('$999') && seed.includes('enterprise'));
assert('Government Contact us', seed.includes('Government') && seed.includes('Contact us'));
assert('Coming Soon buttons', html.includes('Coming Soon') && html.includes('e3PricingComingSoon'));
assert('pricing nav link', html.includes('data-e3-pricing'));
assert('pricing footer link', html.includes('data-e3-pricing'));
assert('E3_BILLING_PAGES bypass onboarding', html.includes('E3_BILLING_PAGES.indexOf(id) < 0'));

// Agent 2 — Stripe test mode skeleton
assert('e3-checkout-pg', html.includes('id="e3-checkout-pg"'));
assert('e3-manage-pg', html.includes('id="e3-manage-pg"'));
assert('TEST MODE label', html.includes('TEST MODE — No real charges'));
assert('e3GetStripePublishableKey', html.includes('function e3GetStripePublishableKey'));
assert('config stripe key only', html.includes('stripeTestPublishableKey') && configExample.includes('stripeTestPublishableKey'));
assert('no hardcoded pk_test in index', !html.match(/pk_test_[a-zA-Z0-9]{10,}/));
assert('no secret keys in index', e3ValidateNoSecretKeys(html));
assert('no secret keys in seed', e3ValidateNoSecretKeys(seed));
assert('all test plan ids', E3_TEST_PLAN_IDS.every(function(id) { return seed.includes(id); }));
assert('e3OpenCheckout', html.includes('function e3OpenCheckout'));
assert('e3SimulateCheckout no charge', html.includes('function e3SimulateCheckout') && html.includes('no real charge'));
assert('e3SimulateCancel', html.includes('function e3SimulateCancel'));
assert('e3SimulateUpgrade', html.includes('function e3SimulateUpgrade'));
assert('stripe module test key', e3IsTestPublishableKey('pk_test_demo_only'));
assert('stripe module rejects live', !e3IsTestPublishableKey('pk_live_bad'));

// Agent 3 — billing dashboard
assert('e3-billing-pg', html.includes('id="e3-billing-pg"'));
assert('e3RenderBillingDashboard', html.includes('function e3RenderBillingDashboard'));
assert('current plan display', html.includes('e3BillingCurrentPlan'));
assert('next billing date', html.includes('e3BillingNextDate') || html.includes('nextBillingDate'));
assert('payment method placeholder', html.includes('e3BillingPaymentMethod'));
assert('invoice history', html.includes('e3BillingInvoices') || html.includes('demoInvoices'));
assert('upgrade downgrade buttons', html.includes('e3BillingUpgrade') && html.includes('e3BillingDowngrade'));
assert('mock invoice module', e3ValidateMockInvoice({ id: 'x', amount: '$0', status: 'demo_paid', testMode: true }));
assert('plan lookup module', e3GetPlanById([{ id: 'free', stripePlanId: null }], 'free'));

// Auth / onboarding preservation
assert('beta login intact', html.includes('beta-login-pg') && html.includes('submitBetaMagicLink'));
assert('onboarding gate intact', html.includes('requiresBetaOnboarding()'));
assert('E2 legal preserved', html.includes('e2-tos-pg') && html.includes('e2InitLegalFramework'));

function runSuite(file) {
  const r = spawnSync('node', [join(QA, file)], { encoding: 'utf8', cwd: QA });
  let json = null;
  try {
    const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/);
    if (m) json = JSON.parse(m[0]);
  } catch (e) { /* ignore */ }
  return { file, json, exit: r.status };
}

const nestedFiles = [
  'sprint-a6-regression-test.mjs',
  'sprint-c1-regression-test.mjs',
  'sprint-b2-regression.mjs',
  'sprint-b4-regression-test.mjs',
  'sprint-v140-regression-test.mjs',
  'sprint-d1-regression-test.mjs',
  'sprint-d2-regression-test.mjs',
  'sprint-d3-regression-test.mjs',
  'sprint-e2-regression-test.mjs',
];
const nested = {};
nestedFiles.forEach(function(f) {
  const r = runSuite(f);
  nested[f] = r.json ? { result: r.json.result, passed: r.json.passed, total: r.json.total } : { result: 'FAIL' };
  assert(f + ' PASS', r.json && r.json.result === 'PASS');
});

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'E3',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
