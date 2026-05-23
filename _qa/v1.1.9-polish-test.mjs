/**
 * v1.1.9 localStorage polish verification
 */
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('LS_BUILD v1.1.9', html.includes("LS_BUILD = '20260523-v1.1.9'"));
assert('Header shows name and state only', html.includes("getElementById('profChip').textContent = (p.name || '').split(' ')[0] + ' \\u2022 ' + (p.state || '')"));
assert('Header does not use beds', !/profChip[\s\S]{0,120}beds/.test(html));
assert('Beta banner title', html.includes('LeaseSmart Beta Testing Mode'));
assert('Beta banner sample copy', html.includes('sample listings') && html.includes('coming soon'));
assert('No filter-chks scroll trap', html.includes('max-height:none') || !html.includes('max-height:150px'));
assert('lsSetListingStatus', html.includes('function lsSetListingStatus'));
assert('lsApplyListingStatuses', html.includes('function lsApplyListingStatuses'));
assert('listingStatuses in LS_STORE', html.includes('listingStatuses'));
assert('NOT INTERESTED in activity', html.includes("'NOT INTERESTED'"));
assert('BEST MATCH rank badge', html.includes('BEST MATCH #') && html.includes('function rankBadgeHtml'));
assert('openEditProfile preserved', html.includes('function openEditProfile'));
assert('updateFavoritesCount', html.includes('function updateFavoritesCount'));
assert('toggleFavorite renders matches', /function toggleFavorite[\s\S]*?renderMatches\(\)/.test(html));
assert('feedback prompt modal', html.includes('id="fbPromptModal"'));
assert('feedbackPromptLater 24h', html.includes('24 * 60 * 60 * 1000'));
assert('tryFeedbackPrompt', html.includes('function tryFeedbackPrompt'));
assert('dashboard 2min timer', html.includes('120000'));
assert('listing views trigger', html.includes('viewedListingIds'));
assert('favCount tab', html.includes('id="favCount"'));
assert('Bathrooms multi', /id:'baths'[\s\S]*?type:'multi'/.test(html));
assert('Commute multi', /id:'commute'[\s\S]*?type:'multi'/.test(html));
assert('Sample labels preserved', html.includes('Sample Listing — Not Real Availability'));

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({ result: failed.length ? 'FAIL' : 'PASS', passed, total: tests.length, tests }, null, 2));
process.exit(failed.length ? 1 : 0);
