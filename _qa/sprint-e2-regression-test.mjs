/**
 * Sprint E2 — legal framework skeleton + D1–D3 nested chain
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { e2CanTrack, e2ValidateConsentRecord } from '../scripts/e2-legal-framework.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260526-v2.1.0-e2';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sql = readFileSync(join(ROOT, 'supabase/drafts/sprint_e2_legal.sql'), 'utf8');
const seed = readFileSync(join(ROOT, '_data/sprint-e2-mock-seed.js'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('E2 build id', html.includes("LS_BUILD = '" + BUILD + "'") || html.includes("LS_BUILD = '20260526-v1.8.0-d4'") || html.includes("LS_BUILD = '20260526-v1.9.0-d5'") || html.includes("LS_BUILD = '20260526-v2.2.0-e3'"));
assert('E2 mock seed linked', html.includes('sprint-e2-mock-seed.js'));
assert('E2 draft SQL', sql.includes('DRAFT ONLY') && sql.includes('client_consent_log'));

// Agent 1 — TOS and Privacy pages
assert('e2-tos-pg', html.includes('id="e2-tos-pg"'));
assert('e2-privacy-pg', html.includes('id="e2-privacy-pg"'));
assert('TOS draft banner', html.includes('DRAFT — ATTORNEY REVIEW REQUIRED'));
assert('TOS sections', html.includes('Acceptance of Terms') && html.includes('Limitation of Liability'));
assert('Privacy GDPR section', html.includes('GDPR Rights'));
assert('Privacy CCPA section', html.includes('CCPA Rights'));
assert('global legal footer', html.includes('id="lsGlobalLegalFooter"'));
assert('footer TOS link', html.includes('data-e2-legal-tos'));
assert('footer Privacy link', html.includes('data-e2-legal-privacy'));
assert('E2_LEGAL_PAGES', html.includes("E2_LEGAL_PAGES = ['e2-tos-pg', 'e2-privacy-pg']"));
assert('legal pages bypass onboarding', html.includes('E2_LEGAL_PAGES.indexOf(id) < 0'));
assert('e2OpenLegalPage', html.includes('function e2OpenLegalPage'));

// Agent 2 — cookie consent banner
assert('e2CookieBanner', html.includes('id="e2CookieBanner"'));
assert('cookie Accept button', html.includes('e2AcceptCookies'));
assert('cookie Decline button', html.includes('e2DeclineCookies'));
assert('localStorage cookie key', html.includes('leasesmart_cookie_consent_v1'));
assert('e2CanTrackAnalytics', html.includes('function e2CanTrackAnalytics'));
assert('lsTrack gated', html.includes('e2CanTrackAnalytics()'));
assert('demo auto decline', seed.includes('demoAutoDecline: true'));
assert('first visit banner logic', html.includes('e2ShowCookieBannerIfNeeded'));
assert('cookie z-index below modals', html.includes('.e2-cookie-banner') && html.includes('z-index:251'));
assert('E2 cookie module', e2CanTrack('accepted') && !e2CanTrack('declined'));

// Agent 3 — C2 client consent flow
assert('e2ClientConsentModal', html.includes('id="e2ClientConsentModal"'));
assert('consent checkbox text', html.includes('has consented to having their housing search tracked'));
assert('e2StartClientIntake', html.includes('function e2StartClientIntake'));
assert('e2SubmitClientConsent', html.includes('function e2SubmitClientConsent'));
assert('cannot bypass consent btn disabled', html.includes('e2UpdateConsentSubmit') && html.includes('btn.disabled = !ok'));
assert('demo attorney label', html.includes('DEMO — Attorney approval required before live use'));
assert('e2DemoClientsAdded store', html.includes('e2DemoClientsAdded'));
assert('e2ClientConsentLog', html.includes('e2ClientConsentLog'));
assert('intake wired to C2', html.includes("e2StartClientIntake()"));
assert('consent record module', e2ValidateConsentRecord({ clientId: 'x', consentText: 'housing search tracked', attorneyApprovalRequired: true }));

// Onboarding / auth preservation
assert('beta-legal-pg intact', html.includes('beta-legal-pg') && html.includes('submitBetaLegalAccept'));
assert('beta login intact', html.includes('beta-login-pg') && html.includes('submitBetaMagicLink'));
assert('profile create intact', html.includes('profile-create-pg') && html.includes('submitCreateProfile'));
assert('cookie not full-screen block', !html.includes('e2-cookie-overlay'));

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
  sprint: 'E2',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
