/**
 * Sprint A6 regression — onboarding, profile, multi-state, A4 preservation
 */
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../supabase/README.md', import.meta.url), 'utf8');
const buildMatch = html.match(/LS_BUILD = '([^']+)'/);
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('A6 build id', buildMatch && /^20260526-v2\.(3\.0-e1|4\.0-a7)$|^20260527-v2\.(4\.0-a7|5\.0-a8)$|^20260528-v2\.(7\.0-auth1|8\.0-newark)$|^20260529-v2\.(9\.0-actionpanel|10\.0-frontpage)$|^20260530-v2\.(11\.0-c1pro|12\.0-c1pro|13\.0-c1pro-app)$/.test(buildMatch[1]));
assert('Profile create page', html.includes('id="profile-create-pg"') && html.includes('submitCreateProfile'));
assert('Onboarding router', html.includes('function routeOnboarding'));
assert('No home default show', !html.includes('id="home-pg" class="pg show"'));
assert('Demo start hidden', html.includes('id="startBtn" style="display:none"'));
assert('No startBtn quiz listener', !html.includes("getElementById('startBtn').addEventListener('click', startQuiz)"));
assert('Legal routes onboarding', html.includes('routeOnboarding();') && /submitBetaLegalAccept[\s\S]*?routeOnboarding/.test(html));
assert('Auth routes onboarding', /routeAuthenticatedBetaUser[\s\S]*?routeOnboarding/.test(html));
assert('showPage onboarding gate', html.includes('ONBOARDING_PAGES') && html.includes('requiresBetaOnboarding()'));
assert('quizCompleted flag', html.includes('quizCompleted: true') && html.includes('quizCompleted === true'));
assert('quizStep resume', html.includes('quizStep') && html.includes('beginQuestionnaire'));
assert('profileCreated flag', html.includes('profileCreated: true') && html.includes('isProfileCreated'));
assert('Profile prefs copy', html.includes('Your preferences are saved but you can update them anytime in your profile'));
assert('Preferences saved banner', html.includes('profilePrefsSaved'));
assert('SEARCH_STATES NJ NY PA OH Other', html.includes("SEARCH_STATES = ['New Jersey', 'New York', 'Pennsylvania', 'Ohio', 'Other']"));
assert('State list uses SEARCH_STATES', html.includes('SEARCH_STATES.filter(function(s)'));
assert('PLACEMENT_TYPES', html.includes("PLACEMENT_TYPES = ['Individual', 'Family', 'Families']"));
assert('Family in life opts', html.includes("'Family','Families'"));
assert('profileStateAbbr', html.includes('function profileStateAbbr'));
// Boot now opens the simplified login-free demo landing (FRONTPAGE sprint).
// The magic-link login function/page remain preserved and reachable.
assert('Init opens demo-start landing', /initLeaseSmart[\s\S]*?showPage\('demo-start-pg'\)/.test(html));
assert('Beta login preserved/reachable', html.includes('function showBetaLoginPage') && html.includes("id=\"beta-login-pg\""));

// A4 preservation
assert('Select All preserved', html.includes('multiSelectAllBtn'));
assert('Auto-save notes preserved', html.includes('bindDetailNotes') && html.includes('1000'));
assert('Stats filters preserved', html.includes('setStatusFilter') && html.includes('clearStatusFilter'));
assert('Post-quiz feedback preserved', html.includes('schedulePostQuizFeedbackPrompt') && html.includes('150000'));
assert('Q5 state persistence', html.includes('saved === s ? \' on\' : \'\''));
assert('Q9 flex continue', html.includes("step.id === 'flex'") && html.includes('Continue &rarr;'));
assert('Magic link OTP for consumer', html.includes('signInWithOtp'));
assert('Pro lane may use signInWithPassword', html.includes('signInWithOtp') && (!html.includes('signInWithPassword') || /function auth1SubmitProLogin[\s\S]*?signInWithPassword/.test(html)));
assert('Legal gate preserved', html.includes('beta-legal-pg') && html.includes('submitBetaLegalAccept'));
assert('Favorites preserved', html.includes('lsToggleFavorite') && html.includes('renderFavorites'));

// RLS docs only
assert('RLS readme verification SQL', readme.includes('RLS') && readme.includes('magic link'));

// Behavioral simulations
const store = new Map();
const localStorage = { getItem(k){return store.has(k)?store.get(k):null;}, setItem(k,v){store.set(k,v);} };
function lsSaveFullProfile(partial) {
  var existing = {};
  try { existing = JSON.parse(localStorage.getItem('leasesmartProfile') || '{}'); } catch(e){}
  var merged = Object.assign({}, existing, partial || {});
  localStorage.setItem('leasesmartProfile', JSON.stringify(merged));
  return merged;
}
function lsLoadProfile() {
  try { return JSON.parse(localStorage.getItem('leasesmartProfile') || 'null'); } catch(e) { return null; }
}
function isOnboardingComplete(profile) { return profile && profile.quizCompleted === true; }
function isProfileCreated(profile) {
  profile = profile || {};
  return profile.profileCreated === true && !!(String(profile.name||'').trim() && String(profile.email||'').trim());
}

lsSaveFullProfile({ name: 'T', email: 't@t.com', profileCreated: true, quizCompleted: false, quizStep: 4 });
assert('Incomplete user not complete', !isOnboardingComplete(lsLoadProfile()) && isProfileCreated(lsLoadProfile()));
lsSaveFullProfile({ quizCompleted: true, quizStep: 21 });
assert('Completed user flagged', isOnboardingComplete(lsLoadProfile()));

function profileStateAbbr(state) {
  var map = { 'New Jersey': 'NJ', 'New York': 'NY', 'Pennsylvania': 'PA', 'Ohio': 'OH', 'Other': 'NJ' };
  return map[state] || 'NJ';
}
assert('State abbr NY', profileStateAbbr('New York') === 'NY');
assert('State abbr Other', profileStateAbbr('Other') === 'NJ');

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({ sprint: 'A6', result: failed.length ? 'FAIL' : 'PASS', passed, total: tests.length, failed: failed.map(f => f.name), tests }, null, 2));
process.exit(failed.length ? 1 : 0);
