/**
 * NEWARK DATA-A1 — Landlord / Housing Inventory Layer regression.
 * 10 required checks per Troy addendum. No commit/push from this script.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  DATA_A1_EXTERNAL_DISCLAIMER,
  dataA1GetListingById,
  dataA1ValidateNoBannedCopy,
  dataA1CountByProviderType
} from '../scripts/data-a1-newark.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const seedJs = readFileSync(join(ROOT, '_data/sprint-data-a1-newark-seed.js'), 'utf8');
const seed = eval('(function(){var window={};' + seedJs + 'return window.SPRINT_DATA_A1;})()');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

const a1Start = html.indexOf('NEWARK DATA-A1');
const a1End = a1Start >= 0 ? html.indexOf('CaseworkerActionPanel', a1Start) : -1;
const a1Block = (a1Start >= 0 && a1End >= 0) ? html.slice(a1Start, a1End) : '';

// 1. Landlord listings included in DATA-A1.
assert('1. Seed has listings array', Array.isArray(seed.listings) && seed.listings.length >= 6);
assert('1a. Listing model fields', seed.listings.every(l =>
  l.listing_id && l.property_name && l.source_type && l.confidence_status && l.voucher_program_fit
));

// 2. Landlord/provider registry exists.
assert('2. Provider registry', Array.isArray(seed.providers) && seed.providers.length >= 8);
assert('2a. Provider categories', seed.providerCategories.includes('manual_landlord_registry')
  && seed.providerCategories.includes('external_listing_reference'));
assert('2b. Provider required fields', seed.providers.every(p =>
  p.provider_id && p.source_name && p.provider_type && p.housing_inventory_supported !== undefined
));

// 3. Landlord cards render in case-manager side.
assert('3. DATA-A1 seed script in index', html.includes('_data/sprint-data-a1-newark-seed.js'));
assert('3a. Newark panel id', html.includes('id="newarkDataA1Panel"'));
assert('3b. Render layer function', html.includes('function dataA1RenderLayer'));
assert('3c. Card renderer + actions', a1Block.includes('dataA1RenderLandlordCard')
  && a1Block.includes('Open maps') && a1Block.includes('Save landlord')
  && a1Block.includes('contactStatus') && a1Block.includes('applicationStatus'));
assert('3d. Hook after analyze', html.includes('dataA1RenderLayer()') && html.includes('newarkRenderResults'));

// 4. 10-for-10 remains connected to housing/property fit.
assert('4. 10-for-10 in Newark results', html.includes('10-for-10') || html.includes('10 for 10'));
assert('4a. DATA-A1 copy links placement intelligence', a1Block.includes('10-for-10') || a1Block.includes('placement intelligence'));

// 5. No apartment-side features deleted.
assert('5. Renter dash still present', html.includes('id="dash-pg"'));
assert('5a. Favorites / search intact', html.includes('tab-favorites') && html.includes('d2SavedSearchProfiles'));

// 6. No scraping added.
assert('6. Seed declares noScrape', seed.meta.noScrape === true);
assert('6a. No fetch/scrape in DATA-A1 block', !/\bfetch\s*\(/.test(a1Block) && !/scrape\s*\(/i.test(a1Block));
assert('6b. External refs are link-only', seed.providers.some(p => p.api_connection_status === 'no_scrape'));

// 7. No Zillow/Apartments live feed.
assert('7. No live feed flags', seed.meta.noLiveFeeds === true);
assert('7a. External listing not inventory-backed', seed.providers.find(p => p.provider_id === 'prov-ext-zillow')
  && seed.providers.find(p => p.provider_id === 'prov-ext-zillow').housing_inventory_supported === false);
assert('7b. No Apartments API import', !/apartments\.com\/api/i.test(html) && !/zillow.*feed/i.test(html));

// 8. No Supabase writes in DATA-A1 layer.
assert('8. No supabase in seed', !/supabase/i.test(seedJs));
assert('8a. LS_STORE persistence — no Supabase in DATA-A1 layer', html.includes('dataA1ListingState')
  && a1Block.includes('dataA1LoadState') && !a1Block.includes('initSupabaseClient'));

// 9. No secrets/API keys.
assert('9. No API keys in seed', !/api[_-]?key|secret|token\s*=\s*['"][^'"]+['"]/i.test(seedJs));
assert('9a. Providers flag needs_key where appropriate', seed.providers.every(p => typeof p.needs_key_or_token === 'boolean'));

// 10. Safe labels — no banned marketing claims.
assert('10. Safe status labels only', seed.safeStatusLabels.length >= 8
  && !seed.safeStatusLabels.some(s => /\b(verified|guaranteed|approved|safe|perfect match)\b/i.test(s)));
assert('10a. Banned copy validator', dataA1ValidateNoBannedCopy(seed.meta.externalLinkDisclaimer));
assert('10b. External disclaimer in UI', a1Block.includes(DATA_A1_EXTERNAL_DISCLAIMER));
assert('10c. Pure mjs helpers', dataA1GetListingById(seed, 'll-manual-001') !== null
  && Object.keys(dataA1CountByProviderType(seed.listings)).length >= 3);

// Workbench link
assert('WB link to DATA-A1', html.includes('dataA1OpenFromWorkbench'));

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log('DATA-A1 regression: ' + passed + '/' + tests.length + ' PASS');
failed.forEach(t => console.log('  FAIL: ' + t.name));
if (failed.length) process.exit(1);
