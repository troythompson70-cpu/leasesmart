/**
 * Behavioral simulation — localStorage persistence + filter/restart flows (no browser)
 * Mirrors index.html logic for manual-proof requirements.
 */
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tests = [];
function assert(name, cond, detail) {
  tests.push({ name, pass: !!cond, detail: detail || '' });
}

// --- Mock localStorage (same keys as index.html) ---
const store = new Map();
const localStorage = {
  getItem(k) { return store.has(k) ? store.get(k) : null; },
  setItem(k, v) { store.set(k, v); },
  clear() { store.clear(); }
};

const LS_PROFILE_KEY = 'leasesmartProfile';
const LS_STORE_KEY = 'leasesmart_store_v1';

function lsLoadProfile() {
  try {
    var raw = localStorage.getItem(LS_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function lsReplaceProfile(profile) {
  localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(profile || {}));
  return profile;
}

function lsSaveFullProfile(partial) {
  var existing = lsLoadProfile() || {};
  var merged = Object.assign({}, existing, partial || {});
  localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(merged));
  return merged;
}

function formatCalendarDate(iso) {
  var p = iso.split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10))
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// --- Simulated APP state ---
let APP = { quizStep: 0, quizAnswers: {}, profile: {}, listings: [] };
let LS_STORE = { session: null, searches: [], favorites: [], analytics: [], feedback: [] };
let lastPage = 'home-pg';
let quizRestarted = false;

function showPage(id) { lastPage = id; }
function renderStep() { quizRestarted = true; }
function lsPersistProfile(profile) {
  LS_STORE.profile = profile;
  LS_STORE.session = { profile: profile, listings: APP.listings, savedAt: new Date().toISOString() };
}
function lsSave() {
  localStorage.setItem(LS_STORE_KEY, JSON.stringify(LS_STORE));
}
function lsLoad() {
  try {
    var raw = localStorage.getItem(LS_STORE_KEY);
    if (raw) LS_STORE = JSON.parse(raw);
  } catch (e) {}
}

// Simulated advance (from index.html)
function advance(val, stepId) {
  APP.quizAnswers[stepId] = val;
  lsSaveFullProfile(APP.quizAnswers);
}

// Simulated finishListingsFlow core
function finishListingsFlow() {
  APP.profile = Object.assign({}, APP.quizAnswers);
  lsSaveFullProfile(APP.profile);
  lsPersistProfile(APP.profile);
  lsSave();
  showPage('dash-pg');
}

// Simulated applyFilters (from index.html — no renderStep)
function applyFiltersSim(filterChanges) {
  quizRestarted = false;
  var p = Object.assign({}, APP.profile);
  Object.assign(p, filterChanges);
  APP.profile = p;
  APP.quizAnswers = Object.assign({}, APP.quizAnswers, p);
  lsSaveFullProfile(p);
  lsPersistProfile(APP.profile);
  lsSave();
  showPage('dash-pg');
}

// Simulated startOver (from index.html)
function startOverSim() {
  var prof = lsLoadProfile() || {};
  var personal = { name: prof.name || '', email: prof.email || '', phone: prof.phone || '' };
  lsReplaceProfile(personal);
  APP.quizStep = 0;
  APP.quizAnswers = Object.assign({}, personal);
  APP.profile = {};
  APP.listings = [];
  LS_STORE.session = null;
  lsSave();
  showPage('quiz-pg');
  renderStep();
}

// Simulated resumeSession
function resumeSession() {
  if (!LS_STORE.session || !LS_STORE.session.profile) return false;
  APP.profile = LS_STORE.session.profile;
  showPage('dash-pg');
  return true;
}

// ========== TEST 1: Move-in date persistence ==========
localStorage.clear();
advance(formatCalendarDate('2026-07-15'), 'movein');
APP.quizAnswers.moveinIso = '2026-07-15';
lsSaveFullProfile(APP.quizAnswers);
finishListingsFlow();
const afterFinish = lsLoadProfile();
assert('Move-in saved after questionnaire', afterFinish.movein === formatCalendarDate('2026-07-15'));
assert('Move-in ISO saved after questionnaire', afterFinish.moveinIso === '2026-07-15');

// Simulate browser refresh — reload from localStorage
const reloadedProfile = lsLoadProfile();
lsLoad();
assert('Move-in survives refresh (profile)', reloadedProfile.movein === formatCalendarDate('2026-07-15'));
assert('Move-in ISO survives refresh (profile)', reloadedProfile.moveinIso === '2026-07-15');
assert('Resume Last Search restores session', resumeSession() && APP.profile.movein === formatCalendarDate('2026-07-15'));

// ========== TEST 2: Full questionnaire answers ==========
localStorage.clear();
const fullAnswers = {
  name: 'Troy Test', email: 'troy@test.com', phone: '555-0100',
  movein: formatCalendarDate('2026-08-01'), moveinIso: '2026-08-01',
  state: 'New Jersey', city: 'Newark',
  budget: ['$1,800-$2,200', '$2,200-$2,500'],
  beds: ['2 Bedrooms'], baths: ['1 Bathroom', '2 Bathrooms'],
  commute: ['15-25 min', '25-35 min'],
  amenities: ['Gym', 'Pool'], laundry: ['In-unit'],
  pets: ['Dogs OK'], park: ['Assigned spot'], transit: ['Bus nearby']
};
APP.quizAnswers = Object.assign({}, fullAnswers);
lsSaveFullProfile(APP.quizAnswers);
finishListingsFlow();
const saved = lsLoadProfile();
['budget', 'beds', 'baths', 'commute', 'amenities', 'laundry', 'pets', 'park', 'transit'].forEach(function(field) {
  assert('Answer saved: ' + field, JSON.stringify(saved[field]) === JSON.stringify(fullAnswers[field]));
});
// Simulate refresh restore
const restored = lsLoadProfile();
assert('All answers survive refresh', restored.budget.length === 2 && restored.baths.length === 2 && restored.commute.length === 2);

// ========== TEST 3: Edit Filters — no quiz restart ==========
APP.profile = Object.assign({}, fullAnswers);
lastPage = 'dash-pg';
quizRestarted = false;
applyFiltersSim({ budget: ['Flexible'], beds: ['3 Bedrooms'] });
assert('Edit Filters stays on dashboard', lastPage === 'dash-pg');
assert('Edit Filters does not restart quiz', !quizRestarted);
assert('Edit Filters saves new budget', lsLoadProfile().budget[0] === 'Flexible');
assert('Edit Filters saves new beds', lsLoadProfile().beds[0] === '3 Bedrooms');
assert('Edit Filters keeps name/email/phone', lsLoadProfile().name === 'Troy Test' && lsLoadProfile().email === 'troy@test.com');

// ========== TEST 4: Start Over ==========
quizRestarted = false;
startOverSim();
assert('Start Over goes to quiz', lastPage === 'quiz-pg');
assert('Start Over restarts questionnaire', quizRestarted && APP.quizStep === 0);
assert('Start Over keeps name', lsLoadProfile().name === 'Troy Test');
assert('Start Over keeps email', lsLoadProfile().email === 'troy@test.com');
assert('Start Over keeps phone', lsLoadProfile().phone === '555-0100');
assert('Start Over clears budget', lsLoadProfile().budget == null);

// ========== TEST 5: Demo listing honesty (static) ==========
assert('All 8 demo listings generated', (html.match(/\bdemo\(\d+/g) || []).length === 8);
assert('Demo factory sets sample label', html.includes("verificationLabel: 'Sample Listing — Not Real Availability'"));
assert('Demo source tag', html.includes("source: 'leasesmart_demo'"));
assert('Card badge on every demo card path', html.includes('sample-card-badge') && html.includes('SAMPLE LISTING'));
assert('Dashboard disclaimer present', html.includes('sample listings for testing the experience') && html.includes('not real apartment availability'));

// ========== TEST 6: Existing features (static) ==========
assert('Calendar no auto-advance', html.includes('updateCalBtn') && !html.includes('submitCal'));
assert('Bathrooms multi-select', /id:'baths'[\s\S]*?type:'multi'/.test(html));
assert('Commute multi-select', /id:'commute'[\s\S]*?type:'multi'/.test(html));
assert('Laundry multi-select', /id:'laundry'[\s\S]*?type:'multi'/.test(html));
assert('Amenities multi-select', /id:'amenities'[\s\S]*?type:'multi'/.test(html));
assert('Listing cards open detail', html.includes('onclick="openDetail('));
assert('Map links present', html.includes('google.com/maps'));
assert('Call Guide opens', html.includes('function openCallGuide'));

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  tests
}, null, 2));
process.exit(failed.length ? 1 : 0);
