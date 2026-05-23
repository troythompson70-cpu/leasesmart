/**
 * Phase 1 clean build verification — no Phase 2/3 leakage
 *
 * RETIRED for v1.1.7+ foundation builds.
 * v1.1.7 intentionally includes Edit Filters, Start Over, and filter modal.
 * Use foundation-v1.1.7-test.mjs + filter-ux-test.mjs + foundation-behavior-test.mjs instead.
 */
import { readFileSync } from 'fs';

const RETIRED_FOR = 'v1.1.7+';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

if (html.includes("LS_BUILD = '20260522-v1.1.7'") || html.includes('Foundation Fix Build')) {
  console.log(JSON.stringify({
    result: 'RETIRED',
    reason: 'phase1-clean-test.mjs is for Phase 1 clean builds only; v1.1.7 foundation includes Edit Filters by design',
    retiredFor: RETIRED_FOR,
    useInstead: ['foundation-v1.1.7-test.mjs', 'filter-ux-test.mjs', 'foundation-behavior-test.mjs']
  }, null, 2));
  process.exit(0);
}
const tests = [];
function assert(name, cond, detail) {
  tests.push({ name, pass: !!cond, detail: detail || '' });
}

// Phase 1 must be present
assert('Bathrooms multi', /id:'baths'[\s\S]*?type:'multi'/.test(html));
assert('Commute multi', /id:'commute'[\s\S]*?type:'multi'/.test(html));
assert('Laundry multi', /id:'laundry'[\s\S]*?type:'multi'/.test(html));
assert('Amenities multi', /id:'amenities'[\s\S]*?type:'multi'/.test(html));
assert('Confirm Selection', html.includes('Confirm Selection'));
assert('Calendar updateCalBtn', html.includes('updateCalBtn') && !html.includes('submitCal'));
assert('Calendar Continue disabled', html.includes('id="qNextBtn" type="button" disabled'));
assert('Profile key leasesmartProfile', html.includes("LS_PROFILE_KEY = 'leasesmartProfile'"));
assert('Listing aptLink on cards', html.includes("if (l.aptLink) cardsHTML"));
assert('820px quiz card', html.includes('max-width:820px'));
assert('12px progress bar', html.includes('.qz-prog{height:12px'));
assert('State cue', html.includes('Choose Your State Below'));
assert('Feedback button enlarged', html.includes('padding:17px 28px') && html.includes('font-size:20px'));

// Phase 2/3 must NOT be present
const forbidden = [
  ['Edit Filters button', 'openEditFilters'],
  ['Start Over button fn', 'function startOver'],
  ['Filter modal', 'filterModal'],
  ['Verified filter fn', 'filterVerifiedListings'],
  ['Test inventory', 'test-apts-1'],
  ['Verified listings notice', 'Verified Listings Only'],
  ['Management contact block', 'Management &amp; Leasing Contact'],
  ['Verified source links fn', 'renderVerifiedSourceLinksHtml'],
  ['isDirectListingUrl', 'isDirectListingUrl'],
  ['getAllTestListingsRaw', 'getAllTestListingsRaw']
];
forbidden.forEach(function(pair) {
  assert('Absent: ' + pair[0], !html.includes(pair[1]), pair[1]);
});

// Phase 1 baseline retained
assert('New Search retained', html.includes('startNewSearch()'));
assert('8 demo listings', (html.match(/demo\(\d+/g) || []).length === 8);

const passed = tests.filter(t => t.pass).length;
const allPass = passed === tests.length;
console.log(JSON.stringify({ result: allPass ? 'PASS' : 'FAIL', passed, total: tests.length, tests }, null, 2));
process.exit(allPass ? 0 : 1);
