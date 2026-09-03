/**
 * Sprint C1-PRO / NEWARK-P2 — Placement Workbench (local state engine).
 * Unit-tests the pure reducers in scripts/c1pro-workbench.mjs, verifies the
 * inline browser copy + page wiring in index.html, checks demo/compliance
 * guarantees, and chains the FRONTPAGE suite (-> ActionPanel -> Newark ->
 * AUTH-1 -> A8/A7/A6).
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildAtLeast } from './build-id-lib.mjs';
import {
  C1PRO_STAGES, C1PRO_APP_STATUSES, C1PRO_READY_THRESHOLD,
  c1proInitState, c1proSetStage, c1proSetAppStatus, c1proToggleFollowUp,
  c1proComputeMetrics, c1proComputeClientMetrics, c1proComputeAgencyMetrics,
  c1proHasReachedStage, c1proUnitMatchesFilter, c1proGetAppRecord
} from '../scripts/c1pro-workbench.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260530-v2.14.0-data-a1';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const seed = readFileSync(join(ROOT, '_data/sprint-c1pro-newark-seed.js'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

// Scope the inline workbench engine block.
const wbStart = html.indexOf('var C1PRO_STAGES');
const wbEnd = wbStart >= 0 ? html.indexOf('</script>', wbStart) : -1;
const wb = (wbStart >= 0 && wbEnd >= 0) ? html.slice(wbStart, wbEnd) : '';

// 1. Build id.
assert('1. Build id', buildAtLeast(html, BUILD));
// 2. Seed loaded + sandbox-safe.
assert('2. Seed script loaded', html.includes('_data/sprint-c1pro-newark-seed.js'));
assert('2a. Seed exposes window.SPRINT_C1PRO', seed.includes('window.SPRINT_C1PRO'));
assert('2b. Seed uses 555 numbers', /\(555\) \d{3}-\d{4}/.test(seed));
assert('2c. No street addresses in seed', !/\b\d+\s+[A-Z][a-z]+\s+(St|Ave|Rd|Blvd|Ln|Pl|Dr|Street|Avenue|Road)\b/.test(seed));
assert('2d. No fetch/Supabase in seed', !/\bfetch\s*\(/.test(seed) && !/supabase/i.test(seed));
assert('2e. Seed has caseworker context fields', seed.includes('moveInReady') && seed.includes('vouchersAccepted') && seed.includes('accessibility') && seed.includes('proximity'));
assert('2f. Seed has full-record detail fields', seed.includes('unitSummary') && seed.includes('agencyRefId') && seed.includes('parking'));
assert('2g. Seed has demo client + app status enum', seed.includes('Marcus Johnson') && seed.includes('appStatuses') && seed.includes('Application Started'));

// 3. Pure reducers — unit tests (the canonical .mjs engine).
const S0 = c1proInitState(eval('(function(){var window={};' + seed + 'return window.SPRINT_C1PRO;})()'));
assert('3. Init seeds all units as Reviewing', S0.units.length === 7 && S0.units.every(u => u.stage === 'Reviewing'));
assert('3a. Init log empty', S0.log.length === 0);
const m0 = c1proComputeMetrics(S0);
assert('3b. Active records = 7', m0.activeRecords === 7);
assert('3c. Placement-ready = 4 (>=80)', m0.placementReady === 4);
assert('3d. Avg readiness = 78', m0.avgReadiness === 78);
assert('3e. Contacts/tours/placed start at 0', m0.contactsLogged === 0 && m0.toursSet === 0 && m0.placed === 0);
const S1 = c1proSetStage(S0, 'asr-a', 'Tour Set');
assert('3f. setStage is pure (S0 unchanged)', S0.units[0].stage === 'Reviewing');
assert('3g. setStage updates target', S1.units[0].stage === 'Tour Set');
assert('3h. setStage logs transition with timestamp', S1.log.length === 1 && S1.log[0].to === 'Tour Set' && !!S1.log[0].at && S1.log[0].unitId === 'asr-a');
const m1 = c1proComputeMetrics(S1);
assert('3i. Tour Set counts as contacted + tour, not application/placed', m1.contactsLogged === 1 && m1.toursSet === 1 && m1.applications === 0 && m1.placed === 0);
const Sapp = c1proSetStage(S1, 'asr-a', 'Application Submitted');
const mApp = c1proComputeMetrics(Sapp);
assert('3i2. Application Submitted increments applications', mApp.applications === 1 && mApp.toursSet === 1 && mApp.placed === 0);
const S2 = c1proSetStage(S1, 'asr-a', 'Placed');
const m2 = c1proComputeMetrics(S2);
assert('3j. Placed increments placed + implies tour + application', m2.placed === 1 && m2.toursSet === 1 && m2.applications === 1);
assert('3k. Invalid stage is a no-op', c1proSetStage(S0, 'asr-a', 'Bogus') === S0);
assert('3l. Seven compliance-safe stages', JSON.stringify(C1PRO_STAGES) === JSON.stringify(['Reviewing', 'Contacted', 'Tour Set', 'Application Submitted', 'Application Approved', 'Placed', 'On Hold']) && C1PRO_READY_THRESHOLD === 80);
const S3 = c1proSetStage(S0, 'asr-a', 'Tour Set');
const m3 = c1proComputeMetrics(S3);
assert('3m. Tour Set counts toward reached Contacted (not zero)', m3.exactStage['Contacted'] === 0 && m3.reachedContacted === 1 && c1proHasReachedStage('Tour Set', 'Contacted'));
const S4 = c1proSetStage(c1proSetStage(c1proSetStage(S0, 'asr-a', 'Tour Set'), 'asr-b', 'Tour Set'), 'asr-c', 'Application Submitted');
assert('3n. Stage tab filter shows all units that reached milestone (cumulative)', c1proUnitMatchesFilter(S4.units[0], 'stage:Contacted') && c1proUnitMatchesFilter(S4.units[2], 'stage:Contacted') && !c1proUnitMatchesFilter(S4.units[0], 'stage:Application Submitted') && c1proUnitMatchesFilter(S4.units[2], 'stage:Application Submitted'));
const CID = 'client-marcus-demo';
const Sa = c1proSetAppStatus(S0, CID, 'asr-b', 'Submitted');
const Sb = c1proSetAppStatus(Sa, CID, 'asr-c', 'Follow-Up Needed');
const Sc = c1proToggleFollowUp(Sb, CID, 'asr-d', 'Call landlord Friday');
assert('3o. Application tracker: setAppStatus + metrics', c1proGetAppRecord(Sc, CID, 'asr-b').status === 'Submitted' && c1proComputeClientMetrics(Sc, CID).appsSubmitted === 1);
assert('3p. Application tracker: follow-up + client metrics', c1proComputeClientMetrics(Sc, CID).followUpsDue >= 2);
assert('3q. Nine application statuses defined', C1PRO_APP_STATUSES.length === 9);

// 4. Inline browser copy present + identical reducer names.
assert('4. Inline engine block present', !!wb);
assert('4a. Inline c1proInitState', wb.includes('function c1proInitState('));
assert('4b. Inline c1proSetStage', wb.includes('function c1proSetStage('));
assert('4c. Inline c1proComputeMetrics', wb.includes('function c1proComputeMetrics('));
assert('4d. Inline render + reset', wb.includes('function c1proRender(') && wb.includes('function c1proResetState('));
assert('4e. Pipeline UI + full record detail rendered', wb.includes('c1proStageTab') && wb.includes('Full record') && wb.includes('c1proRenderUnitDetail') && wb.includes('Rent Within Standard Cap Estimates'));
assert('4f. Clickable metric filters', wb.includes('function c1proOnMetricFilter(') && wb.includes('c1pro-metric-btn') && wb.includes('c1proGetFilteredUnits'));
assert('4g. Metric filter labels + styles', wb.includes('C1PRO_FILTER_LABELS') && wb.includes('c1proEnsureMetricStyles'));
assert('4h. Stage pipeline tabs (all 7 incl. Placed + On Hold)', wb.includes('c1proStageTab') && wb.includes("c1proStageTab('Placed'") && wb.includes("c1proStageTab('On Hold'") && wb.includes('c1proHasReachedStage'));
assert('4i. Tour Set still counts toward reached Contacted', /reachedContacted[\s\S]*?c1proHasReachedStage\(u\.stage, 'Contacted'\)/.test(wb));
assert('4j. Cumulative stage filter in inline engine', wb.includes('c1proHasReachedStage(unit.stage, stage)') && wb.includes('stage === \'Reviewing\''));
assert('4k. Full record detail + timestamped activity feed', wb.includes('c1proOpenUnitDetail') && wb.includes('c1proDetailOverlay') && wb.includes('c1proFormatLogTime') && wb.includes('c1pro-log-ts'));
assert('4l. Activity panel right column layout', wb.includes('c1pro-activity-col') && wb.includes('c1pro-layout'));
assert('4m. Client application tracker UI + reducers', wb.includes('c1proSetAppStatus') && wb.includes('c1proComputeClientMetrics') && wb.includes('c1pro-client-dash') && wb.includes('Application tracker'));
assert('4n. App records persistence keys', html.includes('c1proAppRecords') && wb.includes('c1proPersistAppRecords'));

// 5. Page markup + Pro-mode routing.
assert('5. Workbench page present', html.includes('id="c1pro-workbench-pg"'));
assert('5a. Body mount present', html.includes('id="c1proWorkbenchBody"'));
assert('5b. Registered as internal/Pro-only demo page', /INTERNAL_DEMO_PAGES = \[[^\]]*'c1pro-workbench-pg'/.test(html));
assert('5c. Sets Pro mode on entry', /function c1proShowWorkbench\(\)[\s\S]*?a8SetProductMode\('pro'\)/.test(html));

// 6. Entry points wired.
assert('6. Pro-login demo grid entry', html.includes('Demo: Placement Workbench (NEWARK-P2)') && html.includes('c1proShowWorkbench()'));
assert('6a. Newark page link entry', html.includes('Open Placement Workbench (NEWARK-P2)'));

// 7. Compliance-safe wording.
['Active Sandbox Record', 'Placement Readiness Signal', 'Rent Within Standard Cap Estimates', 'Strong Resource Match'].forEach(function(term) {
  assert('7. Approved term: ' + term, seed.includes(term) || wb.includes(term) || html.includes(term));
});
const banned = [/Verified Landlord/i, /Guaranteed Placement/i, /Safe Neighborhood/i, /Bad Area/i, /Approved Unit/i, /Perfect Fit/i];
assert('7a. No banned terms in workbench scope', !banned.some(r => r.test(wb)) && !banned.some(r => r.test(seed)));
assert('7b. Automated decision-support disclaimer present', html.includes('automated decision-support tools') && seed.includes('official agency guidelines'));

// 8. Demo-only guarantees: no fetch / Supabase / storage in the engine.
assert('8. No fetch in engine', !/\bfetch\s*\(/.test(wb));
assert('8a. No Supabase writes in engine', !/supabase|\.from\(|\.(insert|upsert|update|delete)\s*\(/.test(wb));
assert('8b. No localStorage/sessionStorage in engine', !/localStorage|sessionStorage/.test(wb));

// 9. Renter side untouched + existing flows intact.
assert('9. Renter dash-pg still present', html.includes('id="dash-pg"'));
assert('9a. Analyze Client / Action Panel intact', html.includes('id="newark-placement-pg"') && html.includes('function newarkSubmitIntake(') && html.includes('id="capActionPanel"'));

// 10. Full chain (FRONTPAGE -> ActionPanel -> Newark -> AUTH-1 -> A8/A7/A6).
function runSuite(file) {
  const p = join(QA, file);
  if (!existsSync(p)) return { file, json: null, missing: true };
  const r = spawnSync('node', [p], { encoding: 'utf8', cwd: QA, timeout: 120000 });
  let json = null;
  try { const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/); if (m) json = JSON.parse(m[0]); } catch (e) { /* ignore */ }
  return { file, json, exit: r.status, missing: false };
}
const nested = {};
['sprint-frontpage-regression-test.mjs'].forEach(function(f) {
  const r = runSuite(f);
  nested[f] = r.missing ? { result: 'SKIP' } : (r.json ? { result: r.json.result, passed: r.json.passed, total: r.json.total, nested: r.json.nested } : { result: 'FAIL' });
  if (!r.missing) assert('10. ' + f + ' PASS (chain)', r.json && r.json.result === 'PASS');
});

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'C1-PRO-NEWARK-P2-WORKBENCH',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
