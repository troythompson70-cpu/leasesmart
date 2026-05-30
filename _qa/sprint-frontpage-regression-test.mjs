/**
 * Sprint FRONTPAGE — simplified, login-free demo landing (Jerome demo).
 * Verifies the start page shows two clear demo entry buttons, both route
 * without login, auth code is preserved (just hidden), and no Supabase/auth
 * changes were introduced. Chains the C1-PRO ActionPanel suite, which in turn
 * chains NEWARK -> AUTH-1 -> A8 -> A7 -> A6.
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260529-v2.10.0-frontpage';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

// Scope: the demo-start landing markup block.
const startIdx = html.indexOf('id="demo-start-pg"');
const startEnd = startIdx >= 0 ? html.indexOf('<div id="home-pg"', startIdx) : -1;
const landing = (startIdx >= 0 && startEnd >= 0) ? html.slice(startIdx, startEnd) : '';

// 1. Build id (this sprint).
assert('1. Build id or successor', html.includes("LS_BUILD = '" + BUILD + "'") || html.includes("LS_BUILD = '20260530-v2.11.0-c1pro'") || html.includes("LS_BUILD = '20260530-v2.12.0-c1pro'") || html.includes("LS_BUILD = '20260530-v2.13.0-c1pro-app'"));
// 2. Clean demo landing page exists.
assert('2. demo-start-pg present', !!landing);
// 3. App boots into the clean landing (not the magic-link login page).
assert('3. Boot shows demo-start-pg', html.includes("showPage('demo-start-pg');\n  d4InstallErrorHandlers();") || /initLeaseSmart[\s\S]*?showPage\('demo-start-pg'\)/.test(html));
assert('3b. Boot no longer calls showBetaLoginPage in init', !/showBetaLoginPage\(\);\n  d4InstallErrorHandlers/.test(html));
// 4. Exactly two PRIMARY demo entry buttons on the landing.
const primaryBtns = (landing.match(/class="green-btn"/g) || []).length;
assert('4. Two primary demo buttons', primaryBtns === 2);
assert('4a. Consumer Demo button', landing.includes('demoEnterConsumer()') && /Consumer Apartment Search/i.test(landing));
assert('4b. Caseworker Demo button', landing.includes('demoEnterCaseworker()') && /Caseworker Placement Demo/i.test(landing));
// 5. Demo entry functions defined and login-free.
assert('5. demoEnterConsumer defined', html.includes('function demoEnterConsumer()'));
assert('5b. demoEnterCaseworker defined', html.includes('function demoEnterCaseworker()'));
assert('5c. Consumer routes to dashboard', /function demoEnterConsumer\(\)[\s\S]*?a8RouteToModeHome\(\)/.test(html));
assert('5d. Caseworker routes to Newark placement demo', /function demoEnterCaseworker\(\)[\s\S]*?newarkShowPlacementPage\(\)/.test(html));
// 6. No login wall: landing has no email/password inputs and no magic-link form.
assert('6. No inputs on landing', !/<input/.test(landing));
assert('6b. No magic-link form on landing', !landing.includes('submitBetaMagicLink') && !landing.includes('betaLoginForm'));
// 7. No "must log in" language on the landing (signup/login decision tree removed).
assert('7. No signup/login decision buttons on landing', !landing.includes('showBetaSignupPage()') && !/Need an account\? Sign up/i.test(landing));
assert('7b. Landing states no login required', /No Login Required|no sign-up, no password/i.test(landing));
// 8. Auth code PRESERVED (untouched, just hidden from the landing).
assert('8. Magic-link login code preserved', html.includes('function submitBetaMagicLink(') || html.includes('submitBetaMagicLink()'));
assert('8b. Pro login code preserved', html.includes('function auth1SubmitProLogin(') || html.includes('auth1SubmitProLogin()'));
assert('8c. beta-login-pg still exists (reachable via optional link)', html.includes('id="beta-login-pg"') && landing.includes('showBetaLoginPage()'));
// 9. Sandbox-safe: no real-data claims added to landing.
assert('9. Landing declares sandbox/sample data', /sample data|Sample listings|placeholder values/i.test(landing));
const bannedMarketing = [/Verified Landlord/i, /Guaranteed Placement/i, /Safe Neighborhood/i, /Bad Area/i, /Approved Unit/i, /Perfect Fit/i];
assert('9b. No banned marketing terms on landing', !bannedMarketing.some(r => r.test(landing)));
// 10. No Supabase/auth/schema changes introduced anywhere in this build.
assert('10. No Supabase schema/RLS/auth keys touched', !/createPolicy|alter table|service_role|SUPABASE_SERVICE/i.test(html));
// 11. Existing consumer + caseworker flows intact.
assert('11. Consumer dashboard intact', html.includes('function buildDashboard()') && html.includes('id="dash-pg"'));
assert('11b. Caseworker Analyze flow intact', html.includes('id="newark-placement-pg"') && html.includes('function newarkSubmitIntake(') && html.includes('id="capActionPanel"'));

// 12. Full chain (C1-PRO ActionPanel -> NEWARK -> AUTH-1 -> A8/A7/A6).
function runSuite(file) {
  const p = join(QA, file);
  if (!existsSync(p)) return { file, json: null, missing: true };
  const r = spawnSync('node', [p], { encoding: 'utf8', cwd: QA, timeout: 120000 });
  let json = null;
  try { const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/); if (m) json = JSON.parse(m[0]); } catch (e) { /* ignore */ }
  return { file, json, exit: r.status, missing: false };
}
const nested = {};
['sprint-action-panel-regression-test.mjs'].forEach(function(f) {
  const r = runSuite(f);
  nested[f] = r.missing ? { result: 'SKIP' } : (r.json ? { result: r.json.result, passed: r.json.passed, total: r.json.total, nested: r.json.nested } : { result: 'FAIL' });
  if (!r.missing) assert('12. ' + f + ' PASS (chain)', r.json && r.json.result === 'PASS');
});

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'FRONTPAGE-DEMO-LANDING',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
