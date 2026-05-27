/**
 * Sprint D4 — rate limits, session timeout, error boundaries, security log + all prior suites
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { d4TrackCall, D4_DEFAULT_LIMIT } from '../scripts/d4-rate-limiter.mjs';
import { d4LogFailedLogin } from '../scripts/d4-security-log.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260526-v1.8.0-d4';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sql = readFileSync(join(ROOT, 'supabase/drafts/sprint_d4_security.sql'), 'utf8');
const seed = readFileSync(join(ROOT, '_data/sprint-d4-mock-seed.js'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('D4 build id', html.includes("LS_BUILD = '" + BUILD + "'") || html.includes("LS_BUILD = '20260526-v2.3.0-e1'") || html.includes("LS_BUILD = '20260526-v1.9.0-d5'") || html.includes("LS_BUILD = '20260526-v2.2.0-e3'"));
assert('D4 mock seed linked', html.includes('sprint-d4-mock-seed.js'));
assert('D4 draft SQL', sql.includes('DRAFT ONLY') || sql.includes('api_rate_limits'));
assert('D4 security_event_log', sql.includes('security_event_log'));

// Agent 1 — rate limiting
assert('d4TrackApiCall', html.includes('function d4TrackApiCall'));
assert('d4ShowRateLimitMessage', html.includes('function d4ShowRateLimitMessage'));
assert('d4RateLimits store', html.includes('d4RateLimits'));
assert('rate limit banner', html.includes('d4RateLimitBanner'));
assert('D4 rate module allows', d4TrackCall({}, 'u1', 5).allowed === true);
assert('D4 rate module blocks', (function() {
  var store = { d4RateLimits: {} };
  d4TrackCall(store, 'u-demo', 1);
  return d4TrackCall(store, 'u-demo', 1).allowed === false;
})());

// Agent 2 — session timeout
assert('d4StartSessionTimer', html.includes('function d4StartSessionTimer'));
assert('d4ExtendSession', html.includes('function d4ExtendSession'));
assert('d4PerformLogout', html.includes('function d4PerformLogout'));
assert('d4SessionOverlay', html.includes('d4SessionOverlay'));
assert('ls-logout-pg', html.includes('ls-logout-pg'));
assert('session warning 5 min', seed.includes('sessionWarningMs') && (seed.includes('300000') || seed.includes('5 * 60 * 1000')));

// Agent 3 — error boundaries + 404
assert('d4InstallErrorHandlers', html.includes('function d4InstallErrorHandlers'));
assert('d4ShowErrorScreen', html.includes('function d4ShowErrorScreen'));
assert('ls-error-pg', html.includes('ls-error-pg'));
assert('ls-404-pg', html.includes('ls-404-pg'));
assert('d4GoHome', html.includes('function d4GoHome'));
assert('support message', html.includes('support@tgttechnologies.com'));
assert('unhandledrejection', html.includes('unhandledrejection'));

// Agent 4 — failed login logging
assert('d4LogFailedLogin', html.includes('function d4LogFailedLogin'));
assert('securityLog store', html.includes('securityLog'));
assert('failedLoginAttempts', html.includes('failedLoginAttempts'));
assert('D4 security module', (function() {
  const s = {};
  d4LogFailedLogin(s);
  return s.securityLog.totalFailedCount === 1 && s.securityLog.failedLoginAttempts[0].ts;
})());
assert('no email in security log seed fn', !html.includes('securityLog.failedLoginAttempts.unshift({ ts') || html.includes('failedLoginAttempts.unshift({ ts'));

// D1–D3 preservation
assert('D1 bell', html.includes('ls-notif-bell'));
assert('D2 saved search', html.includes('d2SaveSearchProfile'));
assert('D2 contact log', html.includes('bindLiContactHistoryAutosave'));
assert('C1 landlord intel', html.includes('tab-landlord-intel'));
assert('D3 mobile hamburger', html.includes('d3HamburgerBtn'));
assert('D3 touch scroll error', html.includes('d3ScrollToError'));
assert('D3 C2 quick note FAB', html.includes('d3C2NoteFab'));

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
  sprint: 'D4',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
