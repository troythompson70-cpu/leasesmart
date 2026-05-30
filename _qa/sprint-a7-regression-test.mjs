/**
 * Sprint A7 — Magic-link auth polish + support + A6 nested chain
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260527-v2.5.0-a8';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const emailDoc = readFileSync(join(ROOT, 'master-vault/SUPABASE-EMAIL-SETUP.md'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }
function pgBlock(pgId) {
  var start = html.indexOf('id="' + pgId + '"');
  if (start < 0) return '';
  var rest = html.slice(start);
  var next = rest.slice(10).search(/<div id="[^"]+" class="pg"/);
  return next >= 0 ? rest.slice(0, 10 + next) : rest;
}

assert('A7 build id or successor', html.includes("LS_BUILD = '" + BUILD + "'") || html.includes("LS_BUILD = '20260528-v2.7.0-auth1'") || html.includes("LS_BUILD = '20260528-v2.8.0-newark'") || html.includes("LS_BUILD = '20260529-v2.9.0-actionpanel'") || html.includes("LS_BUILD = '20260529-v2.10.0-frontpage'") || html.includes("LS_BUILD = '20260530-v2.11.0-c1pro'"));

// Agent 1 — auth screen
assert('Sign Up button on home', html.includes('onclick="showBetaSignupPage()">Sign Up</button>'));
assert('Log In button on home', html.includes('onclick="showBetaLoginPage()">Log In</button>'));
assert('Signup name field', html.includes('id="betaSignupName"') && html.includes('Full name'));
assert('Signup email field', html.includes('id="betaSignupEmail"'));
assert('Signup phone field', html.includes('id="betaSignupPhone"'));
assert('Create Account button copy', html.includes('Create Account — Get Magic Link'));
assert('Login email only', html.includes('id="betaLoginEmail"') && !html.match(/beta-login-pg[\s\S]{0,1200}betaSignupName/));
assert('Log In send magic link copy', html.includes('Log In — Send Magic Link'));
assert('Resend magic link', html.includes('a7ResendMagicLink') && html.includes('Resend magic link'));
assert('No forgot password on consumer beta screens', !/forgot password/i.test(pgBlock('beta-signup-pg') + pgBlock('beta-login-pg')));

// Agent 2 — support + email docs
assert('Support text both screens', (html.match(/Having trouble signing in\?/g) || []).length >= 2);
assert('Get Help button', html.includes('a7OpenBetaLoginHelp') && html.includes('Get Help'));
assert('Support mailto email', html.includes("A7_SUPPORT_EMAIL = 'leasesmart@tgttechnologies.com'"));
assert('Support subject', html.includes("A7_SUPPORT_SUBJECT = 'LeaseSmart Beta Login Help'"));
assert('SUPABASE-EMAIL-SETUP.md exists', existsSync(join(ROOT, 'master-vault/SUPABASE-EMAIL-SETUP.md')));
assert('Email doc sender LeaseSmart Beta', emailDoc.includes('LeaseSmart Beta'));
assert('Email doc magic link subject', emailDoc.includes('Your LeaseSmart Beta Magic Link'));
assert('Email doc support email', emailDoc.includes('leasesmart@tgttechnologies.com'));
assert('Email doc SMTP steps', emailDoc.includes('SMTP') && emailDoc.includes('Email Templates'));

// Auth flow preservation
assert('Magic link OTP', html.includes('signInWithOtp'));
assert('No signInWithPassword in consumer beta forms', !/beta-(signup|login)-pg[\s\S]{0,8000}signInWithPassword/.test(html));
assert('No password in beta auth forms', !pgBlock('beta-signup-pg').includes('type="password"') && !pgBlock('beta-login-pg').includes('type="password"'));
assert('routeOnboarding mode routing', html.includes('function routeOnboarding') && html.includes('a8RouteToModeHome()'));
assert('Legal gate intact', html.includes('beta-legal-pg') && html.includes('submitBetaLegalAccept'));
assert('No API keys in index', !html.match(/\bsk-[A-Za-z0-9]{20,}/) && !html.match(/service_role/));
assert('Resend stores last email', html.includes('A7_LAST_MAGIC_EMAIL'));

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

const nestedFiles = ['sprint-a6-regression-test.mjs'];
const nested = {};
nestedFiles.forEach(function(f) {
  const r = runSuite(f);
  nested[f] = r.missing ? { result: 'SKIP' } : (r.json ? { result: r.json.result, passed: r.json.passed, total: r.json.total } : { result: 'FAIL' });
  if (!r.missing) assert(f + ' PASS', r.json && r.json.result === 'PASS');
});

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'A7',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
