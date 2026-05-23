/**
 * v1.1.10 feedback flow + major change warning verification
 */
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('LS_BUILD v1.1.10', html.includes("LS_BUILD = '20260523-v1.1.10'"));
assert('Improved feedback prompt copy', html.includes('Your feedback helps shape the app') && html.includes('beta tester reward'));
assert('Feedback prompt Later button', html.includes('onclick="feedbackPromptLater()"'));
assert('24h suppression', html.includes('24 * 60 * 60 * 1000') && html.includes('feedbackPromptDismissedUntil'));
assert('Dashboard 2min trigger', html.includes('120000') && html.includes('dashboard_2min'));
assert('Listing views trigger (3 listings)', html.includes('viewedListingIds') && html.includes('listing_views'));
assert('Favorites tab trigger', html.includes("tabId === 'tab-favorites'") && html.includes('favorites_tab'));
assert('Start Over deferred feedback', html.includes('pendingStartOver') && html.includes('executeStartOver'));
assert('No exit_detail trigger', !html.includes('exit_detail'));
assert('Guided dropdown category', html.includes('id="fbCategory"') && html.includes('Apartment matches'));
assert('Guided dropdown type', html.includes('id="fbType"') && html.includes('Too many clicks'));
assert('Guided dropdown severity', html.includes('id="fbSeverity"') && html.includes('Blocking issue'));
assert('Guided dropdown rating', html.includes('id="fbRating"') && html.includes('Needs work'));
assert('Comment box placeholder', html.includes('Tell us what happened or what you would improve'));
assert('Phone optional field', html.includes('id="fbPhone"'));
assert('Autofill from profile in openFeedback', /function openFeedback[\s\S]*?lsLoadProfile/.test(html));
assert('Name and email required validation', /function submitFeedback[\s\S]*?!name \|\| !email/.test(html));
assert('Rich feedback payload', html.includes('feedbackCategory') && html.includes('buildVersion') && html.includes('lastAction'));
assert('lastAction tracking function', html.includes('function setLastAction'));
assert('Tab lastAction', html.includes("setLastAction('Viewed ' + tabName + ' tab')"));
assert('Listing lastAction', html.includes("setLastAction('Viewed listing:"));
assert('Questionnaire lastAction', html.includes("setLastAction('Completed step:"));
assert('Filter edit lastAction', html.includes("setLastAction('Edited field:"));
assert('Status lastAction', html.includes("setLastAction('Changed listing status to '"));
assert('Major change modal', html.includes('id="majorChangeModal"') && html.includes('Changing this may update your matches'));
assert('Major change Continue/Cancel', html.includes('confirmMajorChange') && html.includes('cancelMajorChange'));
assert('Major fields defined', html.includes("MAJOR_FIELDS = ['state', 'city', 'movein'"));
assert('Warning only when saved value changes', html.includes('getSavedMajorFieldValue') && html.includes('fieldValuesEqual'));
assert('advance uses major change gate', /function advance[\s\S]*?getSavedMajorFieldValue/.test(html));
assert('applyFilters uses major change gate', /function applyFilters[\s\S]*?getMajorChangesFromFilterForm/.test(html));
assert('v1.1.9 features preserved: rank badges', html.includes('BEST MATCH #') && html.includes('function rankBadgeHtml'));
assert('v1.1.9 features preserved: favorites sync', html.includes('function updateFavoritesCount'));
assert('v1.1.9 features preserved: listing status', html.includes('function lsSetListingStatus'));
assert('v1.1.9 features preserved: Edit Profile', html.includes('function openEditProfile'));
assert('v1.1.9 features preserved: sample disclaimer', html.includes('Sample Listing — Not Real Availability'));

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({ result: failed.length ? 'FAIL' : 'PASS', passed, total: tests.length, failed: failed.map(f => f.name), tests }, null, 2));
process.exit(failed.length ? 1 : 0);
