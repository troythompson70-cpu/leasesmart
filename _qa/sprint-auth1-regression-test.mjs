/**
 * Sprint AUTH-1 — Enterprise Pro auth lane + C1-Pro smoke + nested A8/A7/A6 chain
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildAtLeast } from './build-id-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260528-v2.7.0-auth1';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const draftSql = existsSync(join(ROOT, 'supabase/migrations/DRAFT_sprint_auth1_enterprise.sql'))
  ? readFileSync(join(ROOT, 'supabase/migrations/DRAFT_sprint_auth1_enterprise.sql'), 'utf8')
  : '';
const mockSeed = existsSync(join(ROOT, '_data/sprint-auth1-mock-seed.js'))
  ? readFileSync(join(ROOT, '_data/sprint-auth1-mock-seed.js'), 'utf8')
  : '';
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }
function pgBlock(pgId) {
  var start = html.indexOf('id="' + pgId + '"');
  if (start < 0) return '';
  var rest = html.slice(start);
  var next = rest.slice(10).search(/<div id="[^"]+" class="pg"/);
  return next >= 0 ? rest.slice(0, 10 + next) : rest;
}

assert('AUTH-1 build id or successor', buildAtLeast(html, BUILD));
assert('Auth1 mock seed script', html.includes('sprint-auth1-mock-seed.js'));
assert('SPRINT_AUTH1_MOCK seed file', mockSeed.includes('SPRINT_AUTH1_MOCK') && mockSeed.includes('platform_admin'));

// Pages + UI
assert('Pro login page', html.includes('id="auth1-pro-login-pg"') && html.includes('Case Manager Log In'));
assert('Manage team page', html.includes('id="auth1-manage-team-pg"'));
assert('Home command center CTA', html.includes('auth1ShowProLoginPage()') && html.includes('Case Manager Command Center'));
assert('Sandbox banner copy', html.includes('Demo Sandbox: Admin-Provisioned Profiles Interface'));
assert('No public pro signup', html.includes('No public self-signup'));

// Core JS functions
[
  'auth1GetMock', 'auth1ShowProLoginPage', 'auth1SubmitProLogin', 'auth1DemoLoginAs',
  'auth1RequestPasswordReset', 'auth1ProcessAuthRedirect', 'auth1StripAuthTokensFromUrl',
  'auth1ShowManageTeam', 'auth1RenderManageTeam', 'auth1CanManageTeam', 'auth1MockCreateInvite',
  'auth1ApplyStaffSession'
].forEach(function(fn) {
  assert('Function ' + fn, html.includes('function ' + fn));
});

assert('AUTH1_SESSION object', html.includes('var AUTH1_SESSION'));
assert('AUTH1 in pro pages list', html.includes("'auth1-manage-team-pg'"));
assert('Store auth1LastStaffId', html.includes('auth1LastStaffId'));
assert('Store auth1PendingInvites', html.includes('auth1PendingInvites'));

// Lane split — consumer magic link preserved; pro password only in auth1 lane
assert('Consumer signInWithOtp', html.includes('signInWithOtp'));
assert('Pro signInWithPassword in auth1SubmitProLogin', /function auth1SubmitProLogin[\s\S]*?signInWithPassword/.test(html));
assert('No signInWithPassword in consumer beta forms', !/beta-(signup|login)-pg[\s\S]{0,8000}signInWithPassword/.test(html));
assert('No beta password fields', !pgBlock('beta-signup-pg').includes('type="password"') && !pgBlock('beta-login-pg').includes('type="password"'));
assert('Magic link skips when AUTH1 active', /handleMagicLinkReturn[\s\S]*?AUTH1_SESSION\.active/.test(html));
assert('initBetaAuthSession pro redirect', html.includes('auth1ProcessAuthRedirect(client)'));

// Logout / return paths
assert('Dual logout login paths', html.includes("d4ReturnToLogin('consumer')") && html.includes("d4ReturnToLogin('pro')"));
assert('d4ReturnToLogin pro lane', /function d4ReturnToLogin[\s\S]*?auth1ShowProLoginPage/.test(html));
assert('Logout clears AUTH1 session', /d4PerformLogout[\s\S]*?AUTH1_SESSION\.active = false/.test(html));

// Pro nav Manage Team
assert('Manage Team in pro nav', html.includes("label: 'Manage Team'") && html.includes('auth1ShowManageTeam()'));

// Draft schema — not applied; no password columns / no service role in frontend
assert('Draft AUTH-1 SQL exists', draftSql.includes('organization_staff') && draftSql.includes('DO NOT APPLY'));
assert('No password column in draft staff table', !draftSql.match(/organization_staff[\s\S]*?password/i));
assert('No service_role in index', !html.match(/service_role/));
assert('No API keys in index', !html.match(/\bsk-[A-Za-z0-9]{20,}/));

// Auth config — no deploy generates config.js, so it must stay an override, not a dependency
assert('Auth falls back to shipped constants', /function lsGetSupabaseConfig[\s\S]{0,700}?SUPABASE_ANON_KEY/.test(html));
assert('config.js still overrides', /function lsGetSupabaseConfig[\s\S]{0,400}?LEASESMART_CONFIG/.test(html));
assert('Config source exposed for debugging', html.includes('window.LS_SUPABASE_CONFIG_SOURCE'));

// C1-Pro smoke (bundled in same build)
assert('C1-Pro matches panel', html.includes('function c1proRenderClientMatchesPanelHtml'));
assert('C1-Pro monthly card in C3', /renderC3ReportingDashboard[\s\S]*?c1proRenderC3MonthlyCardHtml/.test(html));
assert('C2 profile uses c1pro panels', /renderC2ClientProfile[\s\S]*?c1proRenderClientMatchesPanelHtml/.test(html));
assert('C2 resolve client helper', html.includes('function c2ResolveClient'));

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

const nestedFiles = ['sprint-a8-regression-test.mjs', 'sprint-a7-regression-test.mjs', 'sprint-a6-regression-test.mjs'];
const nested = {};
nestedFiles.forEach(function(f) {
  const r = runSuite(f);
  nested[f] = r.missing ? { result: 'SKIP' } : (r.json ? { result: r.json.result, passed: r.json.passed, total: r.json.total } : { result: 'FAIL' });
  if (!r.missing) assert(f + ' PASS', r.json && r.json.result === 'PASS');
});

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'AUTH-1',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
