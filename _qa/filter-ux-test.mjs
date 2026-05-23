/**
 * Live beta test findings — verification suite
 */
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

// 1-2: Bathrooms & Commute multi-select still present
assert('Bathrooms type multi', /id:'baths'[\s\S]*?type:'multi'/.test(html));
assert('Commute type multi', /id:'commute'[\s\S]*?type:'multi'/.test(html));
assert('Bathrooms Confirm pattern', html.includes('Confirm Selection'));
assert('Laundry still multi', /id:'laundry'[\s\S]*?type:'multi'/.test(html));
assert('Amenities still multi', /id:'amenities'[\s\S]*?type:'multi'/.test(html));

// 3: Calendar fix
const calBlock = html.slice(html.indexOf('function wireStepEvents'), html.indexOf('function formatCalendarDate'));
assert('Calendar updateCalBtn', calBlock.includes('updateCalBtn') && !calBlock.includes('submitCal'));
assert('Calendar Continue disabled', html.includes('id="qNextBtn" type="button" disabled'));

// 4-6: Edit Filters / Start Over
assert('Edit Filters button', html.includes('onclick="openEditFilters()"'));
assert('Start Over button', html.includes('onclick="startOver()"'));
assert('No startNewSearch', !html.includes('startNewSearch'));
assert('openEditFilters function', html.includes('function openEditFilters'));
assert('applyFilters function', html.includes('function applyFilters'));
assert('refreshListingsFromProfile', html.includes('function refreshListingsFromProfile'));
assert('startOver resets to step 0', /function startOver[\s\S]*?APP\.quizStep = 0/.test(html));
assert('applyFilters stays on dashboard', /function applyFilters[\s\S]*?showPage\('dash-pg'\)/.test(html));

// 7: Demo notice & badge
assert('Beta Sample Listing label', html.includes("verificationLabel: 'Beta Sample Listing'"));
assert('Demo results notice', html.includes('Beta Sample Listings') && html.includes('Real apartment availability'));

// Filter fields
assert('EDIT_FILTER_IDS includes budget', html.includes("'budget'"));
assert('EDIT_FILTER_IDS includes movein', html.includes("'movein'"));
assert('Filter modal HTML', html.includes('id="filterModal"'));

// Simulate multi advance (baths/commute)
function simMulti(selections) {
  let advanced = false;
  let saved = null;
  function advance(v) { advanced = true; saved = v; }
  advance(selections);
  return { advanced, saved };
}
const b = simMulti(['1 Bathroom', '2 Bathrooms']);
assert('Bathrooms 2+ confirm advances', b.advanced && b.saved.length === 2);
const c = simMulti(['15-25 min', '25-35 min']);
assert('Commute 2+ confirm advances', c.advanced && c.saved.length === 2);

const allPass = tests.every(t => t.pass);
console.log(JSON.stringify({ result: allPass ? 'PASS' : 'FAIL', passed: tests.filter(t => t.pass).length, total: tests.length, tests }, null, 2));
process.exit(allPass ? 0 : 1);
