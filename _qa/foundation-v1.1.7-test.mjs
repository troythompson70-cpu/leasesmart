/**
 * Foundation v1.1.7 verification — profile persistence, Edit Filters, sample labels
 */
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

function extractFunctionBody(name) {
  const marker = 'function ' + name + '(';
  const start = html.indexOf(marker);
  if (start < 0) return '';
  let depth = 0;
  let started = false;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '{') { depth++; started = true; }
    else if (html[i] === '}') {
      depth--;
      if (started && depth === 0) return html.slice(start, i + 1);
    }
  }
  return html.slice(start, start + 3000);
}

// Version
assert('LS_BUILD v1.1.7', html.includes("LS_BUILD = '20260522-v1.1.7'"));
assert('Banner v1.1.7', html.includes('LeaseSmart Beta v1.1.7'));

// Task 1: Move-in date persistence
assert('lsSaveFullProfile function', html.includes('function lsSaveFullProfile'));
assert('moveinIso saved on calendar', /APP\.quizAnswers\.moveinIso = cal\.value/.test(html));
const calBlock = html.slice(html.indexOf("} else if (step.type === 'calendar')"), html.indexOf('return h;', html.indexOf("step.type === 'calendar'")));
assert('moveinIso prefill in calendar input', calBlock.includes('APP.quizAnswers.moveinIso') && calBlock.includes('qCalendar'));
assert('advance saves full profile', /function advance[\s\S]*?lsSaveFullProfile\(APP\.quizAnswers\)/.test(html));
assert('finishListingsFlow persists profile', /function finishListingsFlow[\s\S]*?lsPersistProfile\(APP\.profile\)/.test(html));

// Task 2: Full questionnaire persistence
assert('startQuiz loads full profile', /function startQuiz[\s\S]*?Object\.assign\(\{\}, prof\)/.test(html));
assert('submitSteps saves full profile', /function submitSteps[\s\S]*?lsSaveFullProfile\(APP\.profile\)/.test(html));
assert('multi prefill from saved answers', /savedArr\.indexOf\(cb\.getAttribute\('data-val'\)\)/.test(html));

// Task 3: Edit Filters
assert('Edit Filters button', html.includes('onclick="openEditFilters()"'));
assert('Start Over button (not New Search)', html.includes('onclick="startOver()"'));
assert('No startNewSearch', !html.includes('startNewSearch'));
assert('openEditFilters function', html.includes('function openEditFilters'));
assert('applyFilters function', html.includes('function applyFilters'));
assert('filter modal HTML', html.includes('id="filterModal"'));
assert('EDIT_FILTER_IDS includes movein', /EDIT_FILTER_IDS = \[.*'movein'/.test(html));
const applyBody = extractFunctionBody('applyFilters');
assert('applyFilters stays on dashboard', applyBody.includes("showPage('dash-pg')"));
assert('applyFilters does not restart quiz', !applyBody.includes('renderStep'));
assert('applyFilters calls refreshListingsFromProfile', applyBody.includes('refreshListingsFromProfile'));

// Task 4: Demo listing labels
assert('Sample verification label', html.includes('Sample Listing — Not Real Availability'));
assert('Sample card badge', html.includes('SAMPLE LISTING'));
assert('Demo results notice', html.includes('demo-results-notice'));
assert('Dashboard disclaimer text', html.includes('sample listings for testing the experience'));

// Phase 1 preserved
assert('Bathrooms type multi', /id:'baths'[\s\S]*?type:'multi'/.test(html));
assert('Commute type multi', /id:'commute'[\s\S]*?type:'multi'/.test(html));
const wireCalBlock = html.slice(html.indexOf('function wireStepEvents'), html.indexOf('function formatCalendarDate'));
assert('Calendar no auto-advance', wireCalBlock.includes('updateCalBtn') && !wireCalBlock.includes('submitCal'));

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  tests
}, null, 2));
process.exit(failed.length ? 1 : 0);
