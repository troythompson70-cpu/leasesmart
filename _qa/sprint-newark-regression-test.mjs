/**
 * Sprint NEWARK — Placement Readiness (demo support score)
 * Verifies the three locked conditions (display-only neighborhood, no real
 * addresses/lat-long, disclaimer on every score), Fair Housing guards, and
 * regression-chains the AUTH-1 -> A8 -> A7 -> A6 suite.
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260528-v2.8.0-newark';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const seedPath = join(ROOT, '_data/sprint-newark-mock-seed.js');
const seed = existsSync(seedPath) ? readFileSync(seedPath, 'utf8') : '';
const jsonPath = join(ROOT, 'src/data/newark_sandbox_registry.json');
const registryRaw = existsSync(jsonPath) ? readFileSync(jsonPath, 'utf8') : '';
let registry = null;
try { registry = registryRaw ? JSON.parse(registryRaw) : null; } catch (e) { registry = null; }

const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

function fnBody(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) return '';
  const rest = html.slice(start + 1);
  const next = rest.indexOf('\nfunction ');
  return next >= 0 ? rest.slice(0, next) : rest;
}

const ADDRESS_RE = /\b\d+\s+[A-Z][a-z]+\s+(St|Ave|Rd|Blvd|Ln|Pl|Dr|Ct|Street|Avenue|Road|Boulevard|Lane|Place|Drive)\b/;
const LATLNG_RE = /\b(lat|latitude|lng|lon|longitude|coordinates)\b/i;
const DISCLAIMER = 'This is a demo support score based on sandbox data. Final placement decisions require caseworker review and agency approval.';

// Build + wiring
assert('NEWARK build id or successor', html.includes("LS_BUILD = '" + BUILD + "'") || html.includes("LS_BUILD = '20260529-v2.9.0-actionpanel'"));
assert('Newark seed script included', html.includes('_data/sprint-newark-mock-seed.js'));
assert('Newark seed file exists', !!seed);
assert('SPRINT_NEWARK_MOCK global', seed.includes('window.SPRINT_NEWARK_MOCK'));
assert('Registry JSON parses', !!registry);
assert('Page in INTERNAL_DEMO_PAGES', html.includes("'newark-placement-pg'") && html.includes('INTERNAL_DEMO_PAGES'));
assert('Page markup present', html.includes('id="newark-placement-pg"') && html.includes('id="newarkIntakePanel"') && html.includes('id="newarkResultsPanel"'));
assert('Entry-point button present', html.includes('newarkShowPlacementPage()'));
// Reachability: consumer landing page must expose the Case Manager lane
assert('Case Manager entry link on login page', /beta-login-pg[\s\S]*?auth1ShowProLoginPage\(\)[\s\S]*?Case Manager/.test(html));

// Three locked functions / scope
['newarkGetMock', 'newarkShowPlacementPage', 'newarkRenderIntakeForm', 'newarkReadIntake',
 'newarkEvaluatePlacementReadiness', 'newarkBuildResourceSnapshot', 'newarkSubmitIntake', 'newarkRenderResults'
].forEach(function(fn) { assert('Function ' + fn, html.includes('function ' + fn + '(')); });

// Scoring lives in JavaScript (Option A) and returns a 1-10 score
const scoreBody = fnBody('newarkEvaluatePlacementReadiness');
assert('Scoring fn present', !!scoreBody);
assert('Scoring returns score', /return\s*\{\s*score/.test(scoreBody));
assert('Scoring clamps 1-10', html.includes('newarkClamp(Math.round(sum / cats.length), 1, 10)'));

// CONDITION 1 — neighborhood is display-only, never scored
assert('Neighborhood label exists in data', seed.includes('neighborhoodLabel'));
assert('Scoring fn never reads neighborhood', !/neighborhood/i.test(scoreBody));
assert('Display-only field declared', html.includes('neighborhoodPreferenceDisplayOnly') && html.includes('Never passed into the scoring function'));

// CONDITION 2 — no real addresses, no lat/long; zone labels only
assert('Zone label: Central Newark', registryRaw.includes('Central Newark Resource Zone') && seed.includes('Central Newark Resource Zone'));
assert('Zone label: Ferry Street', registryRaw.includes('Ferry Street Corridor') && seed.includes('Ferry Street Corridor'));
assert('Zone label: Bergen Street', registryRaw.includes('Bergen Street Health Resource Zone') && seed.includes('Bergen Street Health Resource Zone'));
assert('No street addresses in registry JSON', !ADDRESS_RE.test(registryRaw));
assert('No street addresses in seed', !ADDRESS_RE.test(seed));
assert('No lat/long in registry JSON', !LATLNG_RE.test(registryRaw));
assert('No lat/long in seed', !LATLNG_RE.test(seed));

// CONDITION 3 — disclaimer below every score
assert('Disclaimer constant exact', html.includes("var NEWARK_SCORE_DISCLAIMER = '" + DISCLAIMER + "'"));
assert('Disclaimer in registry JSON', registryRaw.includes(DISCLAIMER));
assert('Disclaimer rendered on score card', /newark-disclaimer[\s\S]{0,120}NEWARK_SCORE_DISCLAIMER/.test(html));

// Fair Housing guards
assert('Prohibited factors list', html.includes('NEWARK_PROHIBITED_FACTORS') && html.includes("'race'") && html.includes("'ethnicity'") && html.includes("'disability'"));
assert('Allowed factors list', html.includes('NEWARK_ALLOWED_FACTORS') && html.includes("'rent fit'"));
['race', 'ethnicity', 'religion', 'disability', 'demographic', 'safety'].forEach(function(t) {
  assert('Scoring fn excludes "' + t + '"', !new RegExp(t, 'i').test(scoreBody));
});
const catIds = (seed.match(/\bid: '(rent_fit|bedroom_fit|voucher_fit|resource_distance|unit_need_fit|info_completeness|doc_readiness)'/g) || []);
assert('Seven scoring categories in seed', catIds.length === 7);

// 10-for-10 framework — 7 scored + 3 review-only (review-only NOT scored)
assert('Review-only categories constant', html.includes('NEWARK_REVIEW_ONLY_CATEGORIES'));
['Employment / workforce access', 'Community / social support', 'Daily-life needs'].forEach(function(lbl) {
  assert('Review-only label: ' + lbl, html.includes(lbl) && seed.includes(lbl));
});
assert('Review-only labeled not scored', /not scored in demo/i.test(html));
assert('Caseworker review label present', /caseworker (review|assessment)/i.test(html));
assert('Full 10-for-10 visible (7 scored + 3 review)', html.includes('Demo-scored categories (7)') && html.includes('7 of 10 categories scored in demo'));
// Review-only categories must NOT influence the score
['employment_workforce', 'community_support', 'daily_life'].forEach(function(id) {
  assert('Scoring fn excludes review-only "' + id + '"', !scoreBody.includes(id));
});
assert('Analyze Client button label', html.includes('>Analyze Client</button>'));

// Regression — no new live APIs / writes / secrets in Newark code
const newarkBlockStart = html.indexOf('NEWARK_SCORE_DISCLAIMER');
const newarkBlock = newarkBlockStart >= 0 ? html.slice(newarkBlockStart) : '';
assert('No fetch() in Newark code', !/\bfetch\s*\(/.test(newarkBlock));
assert('No supabase writes in Newark code', !/\.(insert|upsert|update|delete)\s*\(/.test(newarkBlock));
assert('No API keys added', !html.match(/\bsk-[A-Za-z0-9]{20,}/));
assert('No service_role added', !/service_role/.test(seed) && !/service_role/.test(registryRaw));
assert('No banned marketing language', !/\b(verified|guaranteed|safe neighborhood|approved placement)\b/i.test(newarkBlock));

// Existing pages intact (regression)
['home-pg', 'dash-pg', 'c2-case-pg', 'auth1-pro-login-pg', 'b5-platform-pg'].forEach(function(pg) {
  assert('Existing page intact: ' + pg, html.includes('id="' + pg + '"'));
});

// Chain prior suite
function runSuite(file) {
  const p = join(QA, file);
  if (!existsSync(p)) return { file, json: null, missing: true };
  const r = spawnSync('node', [p], { encoding: 'utf8', cwd: QA, timeout: 120000 });
  let json = null;
  try { const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/); if (m) json = JSON.parse(m[0]); } catch (e) { /* ignore */ }
  return { file, json, exit: r.status, missing: false };
}
const nested = {};
['sprint-auth1-regression-test.mjs'].forEach(function(f) {
  const r = runSuite(f);
  nested[f] = r.missing ? { result: 'SKIP' } : (r.json ? { result: r.json.result, passed: r.json.passed, total: r.json.total } : { result: 'FAIL' });
  if (!r.missing) assert(f + ' PASS', r.json && r.json.result === 'PASS');
});

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'NEWARK',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
