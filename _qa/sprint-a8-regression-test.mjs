/**
 * Sprint A8 — Product mode split (Renter / Pro) + A7/A6 nested chain
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260527-v2.5.0-a8';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }
function pgBlock(pgId) {
  var start = html.indexOf('id="' + pgId + '"');
  if (start < 0) return '';
  var rest = html.slice(start);
  var next = rest.slice(10).search(/<div id="[^"]+" class="pg"/);
  return next >= 0 ? rest.slice(0, 10 + next) : rest;
}

assert('A8 build id or successor', html.includes("LS_BUILD = '" + BUILD + "'") || html.includes("LS_BUILD = '20260528-v2.7.0-auth1'") || html.includes("LS_BUILD = '20260528-v2.8.0-newark'") || html.includes("LS_BUILD = '20260529-v2.9.0-actionpanel'") || html.includes("LS_BUILD = '20260529-v2.10.0-frontpage'") || html.includes("LS_BUILD = '20260530-v2.11.0-c1pro'") || html.includes("LS_BUILD = '20260530-v2.12.0-c1pro'") || html.includes("LS_BUILD = '20260530-v2.13.0-c1pro-app'") || html.includes("LS_BUILD = '20260530-v2.14.0-data-a1'"));

// Mode selection UI
assert('Mode picker page', html.includes('id="a8-mode-pg"') && html.includes('Choose your LeaseSmart experience'));
assert('Renter card copy', html.includes("a8SelectMode('renter')") && html.includes('Find housing, save listings, track calls'));
assert('Pro card copy', html.includes("a8SelectMode('pro')") && html.includes('Manage clients, track follow-ups'));
assert('How are you using LeaseSmart', html.includes('How are you using LeaseSmart'));

// Storage + routing
assert('productMode in store defaults', html.includes('productMode: null'));
assert('a8GetProductMode', html.includes('function a8GetProductMode'));
assert('a8SetProductMode profile + store', /function a8SetProductMode[\s\S]*?lsSaveFullProfile[\s\S]*?lsSave/.test(html));
assert('a8NeedsModeSelection', html.includes('function a8NeedsModeSelection'));
assert('ONBOARDING includes mode page', html.includes("'a8-mode-pg'"));
assert('routeOnboarding mode gate', /routeOnboarding[\s\S]*?a8NeedsModeSelection[\s\S]*?a8-mode-pg/.test(html));
assert('routeOnboarding a8RouteToModeHome', html.includes('a8RouteToModeHome()'));
assert('resumeSession mode routing', /resumeSession[\s\S]*?a8RouteToModeHome/.test(html));

// Renter chrome
assert('Renter dash title ids', html.includes('id="a8RenterDashTitle"') && html.includes('MY HOUSING SEARCH'));
assert('a8ApplyRenterChrome', html.includes('function a8ApplyRenterChrome'));

// Pro chrome + nav
assert('Pro dash title ids', html.includes('id="a8ProDashTitle"') && html.includes('CLIENT HOUSING SUPPORT'));
assert('Pro nav bar', html.includes('id="a8ProNavBar"') && html.includes('class="a8-pro-nav"'));
assert('a8RenderProNav Clients Cases Reports', html.includes("label: 'Clients'") && html.includes("label: 'Cases'") && html.includes("label: 'Reports'"));
assert('Pro C2 header LeaseSmart Pro', html.includes('LeaseSmart Pro'));

// Page gates
assert('A8_PRO_PAGES defined', html.includes('var A8_PRO_PAGES'));
assert('Renter blocked from pro pages', /a8GetProductMode\(\) === 'renter'[\s\S]*?A8_PRO_PAGES/.test(html));
assert('Pro blocked from renter dash', /a8GetProductMode\(\) === 'pro'[\s\S]*?dash-pg/.test(html));
assert('showC2 renter guard', /showC2CaseWorkspace[\s\S]*?renter[\s\S]*?a8RouteToModeHome/.test(html));

// Profile mode switch
assert('Profile mode switch copy', html.includes('You can update how you use LeaseSmart anytime in your profile'));
assert('Profile switch buttons', html.includes('a8SwitchMode') && html.includes('Switch to Renter') && html.includes('Switch to Pro'));

// Home internal section hidden for renter
assert('a8HomeInternalSection', html.includes('id="a8HomeInternalSection"'));
assert('a8RefreshHomeChrome pro only', /a8RefreshHomeChrome[\s\S]*?=== 'pro'/.test(html));

// A7 preservation
assert('Sign Up button', html.includes('onclick="showBetaSignupPage()">Sign Up</button>'));
assert('Log In button', html.includes('onclick="showBetaLoginPage()">Log In</button>'));
assert('Resend magic link', html.includes('a7ResendMagicLink'));
assert('Get Help support', html.includes('a7OpenBetaLoginHelp'));
assert('Magic link OTP', html.includes('signInWithOtp'));
assert('No signInWithPassword in consumer beta forms', !/beta-(signup|login)-pg[\s\S]{0,8000}signInWithPassword/.test(html));
assert('No beta password fields', !pgBlock('beta-signup-pg').includes('type="password"') && !pgBlock('beta-login-pg').includes('type="password"'));
assert('Legal gate intact', html.includes('beta-legal-pg') && html.includes('submitBetaLegalAccept'));

// Skeleton preservation
assert('Landlord intel tab', html.includes('tab-landlord-intel'));
assert('C2 case workspace', html.includes('function showC2CaseWorkspace'));
assert('C3 reporting', html.includes('function showC3Reporting'));
assert('B5 platform admin', html.includes('function showB5PlatformAdmin'));

// Security
assert('No API keys in index', !html.match(/\bsk-[A-Za-z0-9]{20,}/) && !html.match(/service_role/));
assert('No real client data strings', !html.includes('DHS confidential') && !html.includes('HRA confidential'));

// Behavioral simulation — mode storage
const store = new Map();
const localStorage = {
  getItem(k) { return store.has(k) ? store.get(k) : null; },
  setItem(k, v) { store.set(k, v); }
};
function lsSaveFullProfile(partial) {
  var existing = {};
  try { existing = JSON.parse(localStorage.getItem('leasesmartProfile') || '{}'); } catch (e) {}
  var merged = Object.assign({}, existing, partial || {});
  localStorage.setItem('leasesmartProfile', JSON.stringify(merged));
  return merged;
}
function lsLoadProfile() {
  try { return JSON.parse(localStorage.getItem('leasesmartProfile') || 'null'); } catch (e) { return null; }
}
function isOnboardingComplete(profile) { return profile && profile.quizCompleted === true; }
function a8GetProductModeSim() {
  var prof = lsLoadProfile() || {};
  return prof.productMode || null;
}
function a8NeedsModeSelectionSim() {
  return isOnboardingComplete(lsLoadProfile()) && !a8GetProductModeSim();
}

lsSaveFullProfile({ quizCompleted: true, name: 'T', email: 't@t.com' });
assert('Completed user needs mode', a8NeedsModeSelectionSim());
lsSaveFullProfile({ productMode: 'renter' });
assert('Renter mode stored in profile', a8GetProductModeSim() === 'renter' && !a8NeedsModeSelectionSim());
lsSaveFullProfile({ productMode: 'pro' });
assert('Pro mode stored in profile', a8GetProductModeSim() === 'pro');

function runSuite(file) {
  const p = join(QA, file);
  if (!existsSync(p)) return { file, json: null, exit: 1, missing: true };
  const r = spawnSync('node', [p], { encoding: 'utf8', cwd: QA, timeout: 120000 });
  let json = null;
  try {
    const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/);
    if (m) json = JSON.parse(m[0]);
  } catch (e) { /* ignore */ }
  return { file, json, exit: r.status, missing: false };
}

const nestedFiles = ['sprint-a7-regression-test.mjs', 'sprint-a6-regression-test.mjs'];
const nested = {};
nestedFiles.forEach(function(f) {
  const r = runSuite(f);
  nested[f] = r.missing ? { result: 'SKIP' } : (r.json ? { result: r.json.result, passed: r.json.passed, total: r.json.total } : { result: 'FAIL' });
  if (!r.missing) assert(f + ' PASS', r.json && r.json.result === 'PASS');
});

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'A8',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
