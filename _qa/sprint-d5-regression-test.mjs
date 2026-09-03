/**
 * Sprint D5 — UX polish + full D1–D4 regression chain
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildAtLeast } from './build-id-lib.mjs';
import { d5ValidateTooltip } from '../scripts/d5-ui-polish.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260526-v1.9.0-d5';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const seed = readFileSync(join(ROOT, '_data/sprint-d5-mock-seed.js'), 'utf8');
const d2seed = readFileSync(join(ROOT, '_data/sprint-d2-mock-seed.js'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('D5 build id', buildAtLeast(html, BUILD));
assert('D5 mock seed linked', html.includes('sprint-d5-mock-seed.js'));

// Agent 1 — onboarding progress
assert('d5UpdateOnboardingProgress', html.includes('function d5UpdateOnboardingProgress'));
assert('d5QuizProgressWrap', html.includes('d5QuizProgressWrap'));
assert('Step X of 21 label', html.includes('Step 1 of 21') || html.includes('d5OnboardingStepLabel'));
assert('d5HideOnboardingProgress', html.includes('function d5HideOnboardingProgress'));
assert('green prog fill', html.includes('qz-prog-fill'));

// Agent 2 — skeletons + empty states
assert('d5SkeletonCardsHtml', html.includes('function d5SkeletonCardsHtml'));
assert('d5-empty-state', html.includes('d5-empty-state'));
assert('No clients yet empty', html.includes('No clients yet'));
assert('No listings yet empty', html.includes('No listings yet'));
assert('No notes yet empty', html.includes('No notes yet'));
assert('No follow-ups yet empty', html.includes('No follow-ups yet'));
assert('d5-skeleton-card', html.includes('d5-skeleton-card'));

// Agent 3 — success toasts
assert('d5ShowToast', html.includes('function d5ShowToast'));
assert('d5ToastWrap', html.includes('d5ToastWrap'));
assert('toast auto dismiss 3000', html.includes(', 3000)'));
assert('note_saved toast hook', html.includes("d5ShowToast('note_saved')"));
assert('record_added toast', seed.includes('record_added'));
assert('status_updated toast hook', html.includes("d5ShowToast('status_updated')"));
assert('export_downloaded', html.includes('d5DemoExportDownload'));
assert('filter_applied toast', html.includes("d5ShowToast('filter_applied')"));
assert('follow_up_scheduled', html.includes('d5ScheduleDemoFollowUp'));

// Agent 4 — tooltips
assert('d5TipHtml', html.includes('function d5TipHtml'));
assert('d5-tip-bubble', html.includes('d5-tip-bubble'));
assert('verification tooltip', seed.includes('verification_status'));
assert('program tooltip', seed.includes('program_compatibility'));
assert('case status tooltip', seed.includes('case_status'));
assert('follow_up_date tooltip', seed.includes('follow_up_date'));
assert('listing tooltips', seed.includes('listing_score') && seed.includes('listing_status'));
assert('tooltip word limit', d5ValidateTooltip('Short plain English help text here.'));

// D2 contact history spec alignment
assert('D2 In Person method', d2seed.includes('In Person'));
assert('D2 No Answer outcome', d2seed.includes('No Answer'));

// D4 preservation
assert('D4 rate limit', html.includes('d4TrackApiCall'));
assert('D4 security log', html.includes('d4LogFailedLogin'));

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
  'sprint-d4-regression-test.mjs',
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
  sprint: 'D5',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
