/**
 * v1.1.8 UX polish verification
 */
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('LS_BUILD v1.1.8', html.includes("LS_BUILD = '20260523-v1.1.8'"));
assert('Filter label font 17px', html.includes('.filter-group-lbl{font-weight:800;font-size:17px'));
assert('Filter option font 17px', html.includes('.filter-chk{') && html.includes('font-size:17px'));
assert('No filter-chks max-height scroll', !html.includes('max-height:150px') && html.includes('max-height:none'));
assert('Grid layout for filter options', html.includes('grid-template-columns:repeat(auto-fill,minmax(260px,1fr))'));
assert('openEditProfile function', html.includes('function openEditProfile'));
assert('Edit Profile button on profile tab', html.includes('onclick="openEditProfile()"'));
assert('EDIT_PROFILE_IDS includes name', /EDIT_PROFILE_IDS = EDIT_PERSONAL_IDS\.concat\(EDIT_FILTER_IDS\)/.test(html));
assert('EDIT_PERSONAL_IDS has state city', html.includes("'state', 'city'"));
assert('Profile mode saves personal fields', /APP\.editModalMode === 'profile'[\s\S]*?filter_' \+ fid/.test(html));
assert('applyFilters no renderStep', !/function applyFilters[\s\S]*?renderStep/.test(html.split('function startOver')[0]));
assert('Dashboard Edit Filters retained', html.includes('onclick="openEditFilters()"'));
assert('Bathrooms multi', /id:'baths'[\s\S]*?type:'multi'/.test(html));
assert('Commute multi', /id:'commute'[\s\S]*?type:'multi'/.test(html));
assert('Calendar updateCalBtn', html.includes('updateCalBtn') && !html.includes('submitCal'));
assert('Sample listing labels', html.includes('Sample Listing — Not Real Availability'));
assert('lsSaveFullProfile', html.includes('function lsSaveFullProfile'));

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({ result: failed.length ? 'FAIL' : 'PASS', passed, total: tests.length, tests }, null, 2));
process.exit(failed.length ? 1 : 0);
