/**
 * Sprint D3 — mobile nav, touch forms, C2 quick notes + D1–D2 nested chain
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { D3_TOUCH_MIN, D3_MOBILE_BREAK, d3ValidateTouchTarget } from '../scripts/d3-mobile.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260526-v2.0.0-d3';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const seed = readFileSync(join(ROOT, '_data/sprint-d3-mock-seed.js'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('D3 build id', html.includes("LS_BUILD = '" + BUILD + "'"));
assert('D3 mock seed linked', html.includes('sprint-d3-mock-seed.js'));

// Agent 1 — mobile navigation
assert('d3HamburgerBtn', html.includes('id="d3HamburgerBtn"'));
assert('d3MobileDrawer', html.includes('id="d3MobileDrawer"'));
assert('d3ToggleMobileNav', html.includes('function d3ToggleMobileNav'));
assert('d3CloseMobileNav', html.includes('function d3CloseMobileNav'));
assert('d3RefreshMobileNavLinks', html.includes('function d3RefreshMobileNavLinks'));
assert('768px nav breakpoint', html.includes('@media(max-width:768px)') && html.includes('.d3-hamburger{display:flex}'));
assert('tabs hidden mobile', html.includes('#dash-pg .tabs{display:none!important}'));
assert('drawer transition', html.includes('.d3-mobile-drawer') && html.includes('transition:transform'));
assert('overlay transition', html.includes('.d3-mobile-overlay') && html.includes('transition:opacity'));
assert('nav closes on tab', html.includes('d3CloseMobileNav()'));

// Agent 2 — touch forms
assert('d3 touch min 44', html.includes('--d3-touch-min:44px'));
assert('d3ScrollToError', html.includes('function d3ScrollToError'));
assert('d3-field-error', html.includes('.d3-field-error'));
assert('beta-input min-height mobile', html.includes('.beta-input') && html.includes('min-height:var(--d3-touch-min)'));
assert('labels block mobile', html.includes('.beta-lbl') && html.includes('display:block'));
assert('signup scroll error', html.includes("d3ScrollToError(!name ? 'betaSignupName'"));
assert('profile scroll error', html.includes("d3ScrollToError(required[ri].id"));
assert('D3 touch module', d3ValidateTouchTarget(D3_TOUCH_MIN) && D3_MOBILE_BREAK === 768);

// Agent 3 — C2 quick notes FAB
assert('d3C2NoteFab', html.includes('id="d3C2NoteFab"'));
assert('d3C2NoteSheet', html.includes('id="d3C2NoteSheet"'));
assert('d3OpenC2QuickNote', html.includes('function d3OpenC2QuickNote'));
assert('d3CloseC2QuickNote', html.includes('function d3CloseC2QuickNote'));
assert('auto-save on close', html.includes('d3_quick_note_autosave') && (html.includes("d5ShowToast('note_saved')") || html.includes('d5ShowToast(\'note_saved\')')));
assert('C2 FAB bottom fixed', html.includes('.d3-c2-fab') && html.includes('bottom:24px'));
assert('FAB on C2 pages', html.includes("pageId === 'c2-case-pg' || pageId === 'c2-client-pg'"));
assert('D3 seed touchMinPx', seed.includes('touchMinPx: 44'));

// D1–D2 preservation
assert('D1 bell', html.includes('ls-notif-bell'));
assert('D2 saved search', html.includes('d2SaveSearchProfile'));
assert('D2 contact history', html.includes('liContactHistory'));

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
  sprint: 'D3',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
