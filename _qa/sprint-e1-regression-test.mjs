/**
 * Sprint E1 — Public source imports (HPD, NJ HRC, HUD FMR, benefits) + full nested chain
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildAtLeast } from './build-id-lib.mjs';
import {
  E1_HPD_API_URL,
  E1_HPD_SOURCE_LABEL,
  e1MapHpdToLandlordIntel,
  e1ValidateRecordNoPii,
} from '../scripts/e1-hpd-api.mjs';
import {
  E1_NJ_HRC_LABEL,
  E1_NJ_TARGET_COUNTIES,
  e1MapNjHrcToLandlordIntel,
} from '../scripts/e1-nj-hrc-import.mjs';
import {
  E1_HUD_FMR_LABEL,
  E1_FMR_2026,
  e1GetFmrForCounty,
} from '../scripts/e1-hud-fmr.mjs';
import {
  E1_NYC_BENEFITS_URL,
  e1ScreenDummyHousehold,
  e1ValidateHouseholdNoPii,
} from '../scripts/e1-nyc-benefits-screening.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260526-v2.3.0-e1';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sql = readFileSync(join(ROOT, 'supabase/drafts/sprint_e1_public_sources.sql'), 'utf8');
const pubSeed = readFileSync(join(ROOT, '_data/sprint-e1-public-source-seed.js'), 'utf8');
const mockSeed = readFileSync(join(ROOT, '_data/sprint-e1-mock-seed.js'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('E1 build id', buildAtLeast(html, BUILD));
assert('E1 public seed linked', html.includes('sprint-e1-public-source-seed.js'));
assert('E1 mock seed linked', html.includes('sprint-e1-mock-seed.js'));
assert('E1 draft SQL', sql.includes('DRAFT ONLY') && sql.includes('e1_public_source_imports'));
assert('E1 benefits table', sql.includes('e1_benefits_screenings'));
assert('E1 FMR cache table', sql.includes('e1_hud_fmr_cache'));

// Agent 1 — NYC Open Data HPD API
assert('HPD API module', existsSync(join(ROOT, 'scripts/e1-hpd-api.mjs')));
assert('HPD official API URL', E1_HPD_API_URL.includes('data.cityofnewyork.us') && E1_HPD_API_URL.includes('tesw-yqqr'));
assert('HPD source label', E1_HPD_SOURCE_LABEL === 'Public Source — HPD Registry');
assert('HPD map function', e1MapHpdToLandlordIntel({ boro: 'Manhattan' }, 0).source_label === E1_HPD_SOURCE_LABEL);
assert('HPD no scraping flag', pubSeed.includes('noScraping: true') && pubSeed.includes('officialApiOnly: true'));
assert('HPD seed records', pubSeed.includes('e1-hpd-10001') && pubSeed.includes('e1-hpd-10002'));
assert('HPD no PII validate', e1ValidateRecordNoPii(e1MapHpdToLandlordIntel({}, 0)));
assert('e1SeedPublicSourcesIfNeeded', html.includes('function e1SeedPublicSourcesIfNeeded'));
assert('E1 live import script', existsSync(join(ROOT, 'scripts/e1-live-import.mjs')));
assert('e1InitPublicSources', html.includes('function e1InitPublicSources'));

// Agent 2 — NJ HRC
assert('NJ HRC module', existsSync(join(ROOT, 'scripts/e1-nj-hrc-import.mjs')));
assert('NJ source label', E1_NJ_HRC_LABEL === 'Public Source — NJ Registry');
assert('NJ target counties', E1_NJ_TARGET_COUNTIES.length === 5 && E1_NJ_TARGET_COUNTIES.includes('Essex') && E1_NJ_TARGET_COUNTIES.includes('Union'));
assert('NJ county seeds', ['Essex', 'Passaic', 'Hudson', 'Bergen', 'Union'].every(function(c) { return pubSeed.includes('county: \'' + c + '\''); }));
assert('NJ map function', e1MapNjHrcToLandlordIntel({ county: 'Hudson' }, 0).source_label === E1_NJ_HRC_LABEL);

// Agent 3 — HUD FMR + NYC Benefits
assert('HUD FMR module', existsSync(join(ROOT, 'scripts/e1-hud-fmr.mjs')));
assert('HUD 2026 label', E1_HUD_FMR_LABEL === 'HUD 2026 Fair Market Rate');
assert('HUD FMR Essex 2BR', e1GetFmrForCounty('Essex', 2).amount_usd === E1_FMR_2026.Essex[2]);
assert('HUD not verified claim', e1GetFmrForCounty('Hudson', 1).not_verified_claim === true);
assert('e1GetFmrDisplay in index', html.includes('function e1GetFmrDisplay'));
assert('e1-fmr-panel UI', html.includes('e1-fmr-panel') && html.includes('e1RenderFmrPanelHtml'));
assert('Benefits module', existsSync(join(ROOT, 'scripts/e1-nyc-benefits-screening.mjs')));
assert('NYC opportunity URL', E1_NYC_BENEFITS_URL.includes('nyc.gov'));
assert('Benefits no PII household', e1ValidateHouseholdNoPii({ household_size: 2, income_band: 'low' }));
assert('Benefits rejects PII', !e1ValidateHouseholdNoPii({ name: 'bad' }));
assert('Benefits screen demo', e1ScreenDummyHousehold({ household_size: 3, income_band: 'low' }).no_pii_sent === true);
assert('e1-benefits-panel UI', html.includes('e1-benefits-panel') && html.includes('e1RunBenefitsScreen'));
assert('dummy households in seed', mockSeed.includes('hh-demo-1') && mockSeed.includes('noPii: true'));

// Labels + no verified claims in E1 artifacts
assert('all HPD labeled', (pubSeed.match(/Public Source — HPD Registry/g) || []).length >= 2);
assert('all NJ labeled', (pubSeed.match(/Public Source — NJ Registry/g) || []).length >= 5);
assert('no Public Source Verified in E1 seed', !pubSeed.includes('Public Source Verified'));
assert('no verified vacancy claim in E1 scripts', !readFileSync(join(ROOT, 'scripts/e1-hpd-api.mjs'), 'utf8').includes('Public Source Verified'));
assert('warning not_verified_claim', pubSeed.includes('not_verified_claim'));
assert('e1-source-badge UI', html.includes('e1-source-badge'));
assert('e1-public-banner', html.includes('e1-public-banner'));
assert('no real PII in public seed', !pubSeed.match(/@[a-z]+\.(com|org)/) && !pubSeed.match(/\d{3}-\d{2}-\d{4}/));

// Prior sprint preservation
assert('E3 billing preserved', html.includes('e3-pricing-pg') && html.includes('TEST MODE'));
assert('E2 legal preserved', html.includes('e2-tos-pg') && html.includes('e2InitLegalFramework'));
assert('beta login intact', html.includes('beta-login-pg'));

function runSuite(file) {
  const p = join(QA, file);
  if (!existsSync(p)) return { file, json: null, exit: 1, missing: true };
  const r = spawnSync('node', [p], { encoding: 'utf8', cwd: QA, timeout: 300000 });
  let json = null;
  try {
    const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/);
    if (m) json = JSON.parse(m[0]);
  } catch (e) { /* ignore */ }
  return { file, json, exit: r.status, missing: false };
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
  'sprint-d5-regression-test.mjs',
  'sprint-e2-regression-test.mjs',
  'sprint-e3-regression-test.mjs',
  'sprint-f1-regression-test.mjs',
];
const nested = {};
nestedFiles.forEach(function(f) {
  const r = runSuite(f);
  nested[f] = r.missing ? { result: 'SKIP' } : (r.json ? { result: r.json.result, passed: r.json.passed, total: r.json.total } : { result: 'FAIL' });
  if (!r.missing) assert(f + ' PASS', r.json && r.json.result === 'PASS');
});

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'E1',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
