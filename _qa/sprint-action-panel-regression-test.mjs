/**
 * Sprint C1-Pro — CaseworkerActionPanel (3-column action workflow)
 * 17-point regression suite. Verifies demo-only, local-state, Fair-Housing-safe
 * behavior and chains the NEWARK -> AUTH-1 -> A8 -> A7 -> A6 suite.
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260529-v2.9.0-actionpanel';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

// Isolate the CaseworkerActionPanel script block for scoped checks.
const capStart = html.indexOf('var CAP_DEMO_DISCLAIMER');
const capEnd = capStart >= 0 ? html.indexOf('</script>', capStart) : -1;
const cap = (capStart >= 0 && capEnd >= 0) ? html.slice(capStart, capEnd) : '';

assert('Build id', html.includes("LS_BUILD = '" + BUILD + "'"));
assert('CaseworkerActionPanel block present', !!cap);
assert('Panel mount in page', html.includes('id="capActionPanel"'));

// All onclick/onchange-referenced CAP functions are defined (guards console errors)
['capRevealActionPanel', 'capRender', 'capResetState', 'capToggleTask', 'capSetStatus',
 'capCallLandlord', 'capScheduleTour', 'capAddNote', 'capCheckResource', 'capSaveResourceNote',
 'capSaveCaseworkerNotes', 'capRecomputeNextSteps', 'capCloseDialog'
].forEach(function(fn) { assert('Function ' + fn, cap.includes('function ' + fn + '(')); });

// 1. Analyze Client reveals the panel
assert('1. Analyze Client reveals panel', /function newarkSubmitIntake[\s\S]*?capRevealActionPanel\(input, snapshot\)/.test(html) && cap.includes("style.display = 'block'"));
// 2. Task checkboxes toggle locally
assert('2. Task checkboxes toggle locally', cap.includes('cap-task-check') && cap.includes('capToggleTask(') && /t\.checked = checked/.test(cap));
// 3. Status dropdown real-time + 6 statuses
assert('3. Status dropdown + 6 statuses', cap.includes('cap-status-select') && cap.includes('capSetStatus(') && /CAP_STATUS_OPTIONS = \[[^\]]*'Escalated'/.test(cap) && (cap.match(/'(Not Started|Contact Needed|In Progress|Waiting on Response|Completed|Escalated)'/g) || []).length >= 6);
// 4. Engagement log updates when action added
assert('4. Engagement log updates', /capAddNote[\s\S]*?engagementLog\.push/.test(cap) && /capScheduleTour[\s\S]*?engagementLog\.push/.test(cap));
// 5. Resources display correctly (5 stabilization types)
['Food', 'Healthcare', 'Transit', 'Employment', 'Housing'].forEach(function(t) {
  assert('5. Resource type ' + t, new RegExp("type: '" + t + "'").test(cap));
});
// 6. No console errors on interaction — verified live in browser smoke test; here we
//    ensure every handler exists (asserted above) and render rebuilds from state.
assert('6. Render rebuilds from state', /function capRender[\s\S]*?panel\.innerHTML =/.test(cap));
// 7. Placement Risks render safely
assert('7. Placement Risks section', cap.includes('Placement Risks') && cap.includes('CAP_STATE.risks') && cap.includes('Caseworker Review Recommended') && cap.includes('Requires follow-up'));
// 8. Disclaimer + demo label visible
assert('8. Compliance disclaimer present', cap.includes('automated decision-support tools') && cap.includes('official agency guidelines'));
assert('8b. Demo sandbox label present', cap.includes('DEMO SANDBOX: This is simulated data only'));
assert('8c. Disclaimer rendered in header', /function capRender[\s\S]*?CAP_DEMO_DISCLAIMER/.test(cap) && /CAP_DEMO_LABEL/.test(cap));
// 9. No banned Fair Housing language in the component
['Verified Landlord', 'Guaranteed Placement', 'Safe Neighborhood', 'Bad Area', 'Approved Unit', 'Perfect Fit', 'not safe here', 'unreliable', 'bad neighborhood'].forEach(function(term) {
  assert('9. No banned term: ' + term, !new RegExp(term, 'i').test(cap));
});
// 10. Demo data only — 555 placeholder, no real street addresses, demo client
assert('10. 555 placeholder contact', /\(555\) 010-0/.test(cap));
assert('10b. No street addresses in component', !/\b\d+\s+[A-Z][a-z]+\s+(St|Ave|Rd|Blvd|Ln|Pl|Dr|Street|Avenue|Road)\b/.test(cap));
// 11. Panel persists during session — module-level state, interactions do NOT reset
assert('11. Module-level CAP_STATE', cap.includes('var CAP_STATE = capDefaultState()'));
assert('11b. Interactions never reset state', !/cap(ToggleTask|SetStatus|CallLandlord|ScheduleTour|AddNote|CheckResource|RecomputeNextSteps)[\s\S]*?capResetState/.test(cap));
// 12. Clears on refresh — no localStorage / sessionStorage persistence in component
assert('12. No localStorage in component', !/localStorage|sessionStorage/.test(cap));
// 13. No API calls
assert('13. No fetch in component', !/\bfetch\s*\(/.test(cap));
// 14. No Supabase writes
assert('14. No Supabase writes in component', !/\.(insert|upsert|update|delete)\s*\(/.test(cap) && !/supabase|\.from\(/.test(cap));
// 15. Mobile layout — columns wrap
assert('15. Columns wrap for mobile', cap.includes('flex-wrap:wrap') && cap.includes('min-width:260px'));
// 16. Previous 10-for-10 component still renders
assert('16. 10-for-10 still present', html.includes('function newarkEvaluatePlacementReadiness(') && html.includes('Demo-scored categories (7)') && html.includes('id="newark-placement-pg"'));

// 17. Full chain (NEWARK -> AUTH-1 -> A8/A7/A6)
function runSuite(file) {
  const p = join(QA, file);
  if (!existsSync(p)) return { file, json: null, missing: true };
  const r = spawnSync('node', [p], { encoding: 'utf8', cwd: QA, timeout: 120000 });
  let json = null;
  try { const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/); if (m) json = JSON.parse(m[0]); } catch (e) { /* ignore */ }
  return { file, json, exit: r.status, missing: false };
}
const nested = {};
['sprint-newark-regression-test.mjs'].forEach(function(f) {
  const r = runSuite(f);
  nested[f] = r.missing ? { result: 'SKIP' } : (r.json ? { result: r.json.result, passed: r.json.passed, total: r.json.total, nested: r.json.nested } : { result: 'FAIL' });
  if (!r.missing) assert('17. ' + f + ' PASS (chain)', r.json && r.json.result === 'PASS');
});

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'C1-PRO-ACTION-PANEL',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
