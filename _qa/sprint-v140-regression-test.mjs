/**
 * Sprint v1.4.0 — C2 + C3 + B5 + B3 regression + A6/C1/B2/B4 preservation
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260526-v2.0.0-d3';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const seed = readFileSync(join(ROOT, '_data/sprint-v140-mock-seed.js'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('v1.9.0 build id', html.includes("LS_BUILD = '" + BUILD + "'"));
assert('v140 mock seed linked', html.includes('sprint-v140-mock-seed.js'));
assert('Mock seed no real data', seed.includes('noRealClientData: true'));

// C2 Case Management
assert('C2 case page', html.includes('c2-case-pg'));
assert('C2 client profile page', html.includes('c2-client-pg'));
assert('C2 My Clients', html.includes('renderC2CaseWorkspace'));
assert('C2 notes 1s debounce', html.includes('bindC2CaseNotes') && html.includes('1000'));
assert('C2 follow-up tracker', html.includes('renderC2FollowUpTracker'));
assert('C2 status tags', html.includes('c2StatusTag'));
assert('C2 B4 permissions', html.includes('b4FilterClientsForRole') && html.includes('b4CanViewClient'));
assert('C2 DEMO INTERNAL label', html.includes('DEMO/INTERNAL'));

// C3 Reporting
assert('C3 reporting page', html.includes('c3-reporting-pg'));
assert('C3 placements metric', html.includes('Placements') && html.includes('DEMO METRIC'));
assert('C3 calls made', html.includes('Calls made'));
assert('C3 follow-ups due', html.includes('Follow-ups due'));
assert('C3 active cases', html.includes('Active cases'));
assert('C3 time saved', html.includes('Time saved'));
assert('C3 status breakdown', html.includes('Case status breakdown'));
assert('C3 INTERNAL PREVIEW label', html.includes('INTERNAL PREVIEW'));
assert('C3 no grant claims', !html.match(/grant.*funded|investor.*return/i));

// B5 Admin
assert('B5 platform page', html.includes('b5-platform-pg'));
assert('B5 total users mock', html.includes('Total users'));
assert('B5 active sessions', html.includes('Active sessions'));
assert('B5 feedback count', html.includes('Feedback count'));
assert('B5 feature usage', html.includes('Feature usage'));
assert('B5 system health', html.includes('System health'));
assert('B5 recent activity', html.includes('Recent activity'));
assert('B5 admin gate', html.includes('canAccessB5PlatformAdmin'));
assert('B5 mask email', html.includes('lsMaskEmail'));
assert('B5 no service role', !html.includes('service_role') && !html.includes('SERVICE_ROLE'));

// B3 User Data
assert('B3 user data page', html.includes('b3-user-data-pg'));
assert('B3 data categories', html.includes('renderB3UserDataDashboard'));
assert('B3 demo labels', html.includes('DEMO DATA PREVIEW'));
assert('B3 mask phone', html.includes('lsMaskPhone'));
assert('B3 no production consent', html.includes('No production consent') && html.includes('Skeleton preview only'));

// Onboarding bypass for internal pages
['c2-case-pg', 'c2-client-pg', 'c3-reporting-pg', 'b3-user-data-pg', 'b5-platform-pg'].forEach(function(pg) {
  assert('Internal page bypass ' + pg, html.includes("'" + pg + "'"));
});

// B4 preservation + user mgmt permissions
assert('B4 user_management_permissions in SQL', existsSync(join(ROOT, 'supabase/drafts/sprint_b4_foundation.sql')));
assert('B4 caseworker no add users', html.includes('b4CanAddUsers') && html.includes('Caseworkers cannot add users'));

// Preservation
assert('A6 routeOnboarding', html.includes('function routeOnboarding'));
assert('C1 landlord intel', html.includes('tab-landlord-intel'));
assert('B2 sprint log', existsSync(join(ROOT, 'scripts/sprint-log.mjs')));
assert('B4 foundation sql', existsSync(join(ROOT, 'supabase/drafts/sprint_b4_foundation.sql')));

function runSuite(file) {
  const r = spawnSync('node', [join(QA, file)], { encoding: 'utf8', cwd: QA });
  let json = null;
  try {
    const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/);
    if (m) json = JSON.parse(m[0]);
  } catch (e) { /* ignore */ }
  return { file, json };
}

const nested = ['sprint-a6-regression-test.mjs', 'sprint-c1-regression-test.mjs', 'sprint-b2-regression.mjs', 'sprint-b4-regression-test.mjs'];
nested.forEach(function(f) {
  const r = runSuite(f);
  assert(f + ' PASS', r.json && r.json.result === 'PASS');
});

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'v1.4.0-C2-C3-B5-B3',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
