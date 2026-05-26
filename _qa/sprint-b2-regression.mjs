/**
 * Sprint B2 regression — documentation logger + morning checklist + A6/C1 preservation
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sanitize } from '../scripts/sprint-log-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const buildMatch = html.match(/LS_BUILD = '([^']+)'/);
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

// B2 tooling
assert('B2 sprint-log-lib exists', existsSync(join(ROOT, 'scripts/sprint-log-lib.mjs')));
assert('B2 sprint-log CLI exists', existsSync(join(ROOT, 'scripts/sprint-log.mjs')));
assert('B2 morning-checklist exists', existsSync(join(ROOT, 'scripts/morning-checklist.mjs')));
assert('B2 master-vault README', existsSync(join(ROOT, 'master-vault/README.md')));

const lib = readFileSync(join(ROOT, 'scripts/sprint-log-lib.mjs'), 'utf8');
assert('Sanitizer function', lib.includes('export function sanitize'));
assert('Redacts sk-ant keys', lib.includes('sk-ant-'));
assert('Redacts service role', /service[_\s-]?role/i.test(lib));
assert('Master log path', lib.includes('LeaseSmart-Sprint-Master-Log.md'));
assert('Morning review path', lib.includes('MORNING-REVIEW-latest.md'));

const logCli = readFileSync(join(ROOT, 'scripts/sprint-log.mjs'), 'utf8');
assert('Log types command cursor claude go-no-go', ['command', 'cursor-report', 'claude-review', 'go-no-go'].every(t => logCli.includes("'" + t + "'")));

const morning = readFileSync(join(ROOT, 'scripts/morning-checklist.mjs'), 'utf8');
assert('Morning runs A6 test', morning.includes('sprint-a6-regression-test.mjs'));
assert('Morning runs C1 test', morning.includes('sprint-c1-regression-test.mjs'));
assert('Morning sections for Troy', ['What was built', 'What passed', 'What failed', 'What needs review', 'Ready for commit', 'What needs to wait'].every(s => morning.includes(s)));
assert('Morning writes handoff HTML', morning.includes('HANDOFF-latest.html'));

// Sanitizer behavior
const fakeKey = 'sk-ant-api03-' + 'x'.repeat(40);
assert('Sanitizer redacts API key', sanitize('key=' + fakeKey).includes('[REDACTED]') && !sanitize('key=' + fakeKey).includes(fakeKey));
assert('Sanitizer redacts password', sanitize('password=SuperSecret123!').includes('[REDACTED]'));

// A6 preservation (spot checks)
assert('A6 onboarding route', html.includes('function routeOnboarding'));
assert('A6 profile create', html.includes('profile-create-pg'));
assert('A6 quiz completed', html.includes('quizCompleted === true'));
assert('A6 SEARCH_STATES', html.includes('SEARCH_STATES'));

// C1 preservation (spot checks)
assert('C1 Landlord Intel tab', html.includes('tab-landlord-intel'));
assert('C1 verification levels', html.includes('LANDLORD_INTEL_VERIFICATION_LEVELS'));
assert('C1 seed linked', html.includes('landlord-intel-seed-nj.js'));
assert('C1 build id', buildMatch && /^20260526-v/.test(buildMatch[1]));

// Copy for Claude handoff button
assert('Handoff copy lib exists', existsSync(join(ROOT, 'scripts/handoff-copy-lib.mjs')));
const handoff = readFileSync(join(ROOT, 'scripts/handoff-copy-lib.mjs'), 'utf8');
assert('Copy for Claude label', handoff.includes('Copy for Claude'));
assert('Handoff copy script', handoff.includes('lsCopyHandoffForClaude'));

function runSuite(file) {
  const r = spawnSync('node', [join(QA, file)], { encoding: 'utf8', cwd: QA });
  let json = null;
  try {
    const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/);
    if (m) json = JSON.parse(m[0]);
  } catch (e) { /* ignore */ }
  return { file, exit: r.status, json };
}

const a6Run = runSuite('sprint-a6-regression-test.mjs');
const c1Run = runSuite('sprint-c1-regression-test.mjs');
assert('A6 regression PASS', a6Run.json && a6Run.json.result === 'PASS');
assert('C1 regression PASS', c1Run.json && c1Run.json.result === 'PASS');

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
const payload = {
  sprint: 'B2',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  nested: {
    a6: a6Run.json ? { result: a6Run.json.result, passed: a6Run.json.passed, total: a6Run.json.total } : { result: 'UNKNOWN' },
    c1: c1Run.json ? { result: c1Run.json.result, passed: c1Run.json.passed, total: c1Run.json.total } : { result: 'UNKNOWN' },
  },
  tests,
};
console.log(JSON.stringify(payload, null, 2));
process.exit(failed.length ? 1 : 0);
