/**
 * Sprint D2 — landlord filters, saved search alerts, contact history + all prior suites
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildAtLeast } from './build-id-lib.mjs';
import {
  d2MatchLandlords,
  d2FindNewMatches,
  D2_ALERT_TYPE,
} from '../scripts/d2-saved-search-alerts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260526-v1.6.0-d2';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sql = readFileSync(join(ROOT, 'supabase/drafts/sprint_d2_landlord_search.sql'), 'utf8');
const seed = readFileSync(join(ROOT, '_data/sprint-d2-mock-seed.js'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('D2 build id', buildAtLeast(html, BUILD));
assert('D2 mock seed linked', html.includes('sprint-d2-mock-seed.js'));
assert('D2 draft SQL', sql.includes('DRAFT ONLY') || sql.includes('saved_search_profiles'));
assert('D2 saved_search_profiles table', sql.includes('saved_search_profiles'));
assert('D2 landlord_contact_history table', sql.includes('landlord_contact_history'));

// Agent 1 — advanced landlord filters
assert('liApplyIntelFilters', html.includes('function liApplyIntelFilters'));
assert('liSetFilter', html.includes('function liSetFilter'));
assert('LANDLORD_INTEL_PROGRAM_TYPES', html.includes('LANDLORD_INTEL_PROGRAM_TYPES'));
assert('program filter UI', html.includes("liSetFilter(\\'program\\'"));
assert('verification filter UI', html.includes("liSetFilter(\\'verification\\'"));
assert('availability filter UI', html.includes("liSetFilter(\\'availability\\'"));
assert('county filter UI', html.includes("liSetFilter(\\'county\\'"));
assert('program_compatibility field', html.includes('program_compatibility'));
assert('program types in seed', seed.includes('programCompatibilityTypes'));

// Agent 2 — saved search alerts
assert('d2SaveSearchProfile', html.includes('function d2SaveSearchProfile'));
assert('d2CheckSavedSearchAlerts', html.includes('function d2CheckSavedSearchAlerts'));
assert('d2SavedSearchProfiles store', html.includes('d2SavedSearchProfiles'));
assert('saved_search_match alert', html.includes('saved_search_match'));
assert('d2 saved search UI', html.includes('Save current search'));
assert('D2 alert type export', D2_ALERT_TYPE === 'saved_search_match');
assert('D2 match module', d2MatchLandlords([{ county: 'Essex', verification_status: 'Imported', availability_status: 'Units Available', program_compatibility: 'Section 8' }], { county: 'Essex' }).length === 1);
assert('D2 find new matches', d2FindNewMatches({ id: 'd2-sp-demo-1', seenIds: [] }, [], [{ profileId: 'd2-sp-demo-1', landlordId: 'li-nj-7', title: 'T', message: 'M' }]).length === 1);

// Agent 3 — contact history
assert('liGetContactHistory', html.includes('function liGetContactHistory'));
assert('liAddContactAttempt', html.includes('function liAddContactAttempt'));
assert('bindLiContactHistoryAutosave', html.includes('function bindLiContactHistoryAutosave'));
assert('liContactHistory store', html.includes('liContactHistory'));
assert('contact history UI', html.includes('liContactHistoryBody'));
assert('1 second autosave debounce', html.includes('APP.liContactDebounceTimer') && html.includes(', 1000)'));
assert('contact history seed', seed.includes('contactHistorySeed'));

// D1 preservation
assert('D1 mock seed linked', html.includes('sprint-d1-mock-seed.js'));
assert('D1 notification bell', html.includes('ls-notif-bell'));
assert('d1NotifyCaseworkerAssigned', html.includes('function d1NotifyCaseworkerAssigned'));
assert('d1EmailOutbox store', html.includes('d1EmailOutbox'));

// Prior sprint spot checks
assert('A6 onboarding', html.includes('function routeOnboarding'));
assert('C1 landlord tab', html.includes('tab-landlord-intel'));
assert('B4 permissions', html.includes('b4CanAddUsers'));
assert('C2 workspace', html.includes('c2-case-pg'));
assert('C3 reporting', html.includes('c3-reporting-pg'));
assert('B5 platform', html.includes('b5-platform-pg'));
assert('B3 user data', html.includes('b3-user-data-pg'));

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
  sprint: 'D2',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
