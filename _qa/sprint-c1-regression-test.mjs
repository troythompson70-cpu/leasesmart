/**
 * Sprint C1 regression — landlord intelligence + A6 preservation
 */
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/drafts/sprint_c1_landlord_intelligence.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../_data/landlord-intel-seed-nj.js', import.meta.url), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('C1 build id', html.includes("LS_BUILD = '20260526-v1.2.0-c1'"));
assert('Draft SQL file exists', sql.includes('CREATE TABLE IF NOT EXISTS public.landlord_intelligence'));
assert('Draft SQL not in migrations apply path only', sql.includes('DRAFT ONLY'));
assert('All landlord fields in SQL', ['landlord_name', 'property_name', 'case_manager_notes', 'next_recheck_date', 'warning_flags'].every(f => sql.includes(f)));
assert('RLS own or public', sql.includes('is_public = true') && sql.includes('current_app_user_id()'));
assert('8 verification levels in SQL', [
  'Imported', 'Public Source Verified', 'Contact Verified', 'Recently Contacted',
  'Availability Confirmed', 'Needs Recheck', 'Inactive', 'Bad Lead'
].every(v => sql.includes("'" + v + "'")));
assert('Landlord Intel tab', html.includes('tab-landlord-intel') && html.includes('Landlord Intel'));
assert('Verification dropdown constant', html.includes('LANDLORD_INTEL_VERIFICATION_LEVELS'));
assert('Landlord modal + save', html.includes('landlordIntelModal') && html.includes('saveLandlordIntelForm'));
assert('renderLandlordIntel', html.includes('function renderLandlordIntel'));
assert('Seed script linked', html.includes('landlord-intel-seed-nj.js'));
assert('50 dummy records in seed', seed.includes('.slice(0, 50)') && seed.includes('Demo Property Group'));
assert('5 NJ counties in seed', ['Essex', 'Passaic', 'Hudson', 'Bergen', 'Union'].every(c => seed.includes("county: '" + c + "'")));
assert('Dummy email domain', seed.includes('@leasesmart-demo.invalid'));
assert('localStorage landlordIntel', html.includes('landlordIntel: []'));

// A6 preservation
assert('A6 onboarding route', html.includes('function routeOnboarding'));
assert('Profile create page', html.includes('profile-create-pg'));
assert('Quiz completed flag', html.includes('quizCompleted === true'));
assert('SEARCH_STATES', html.includes('SEARCH_STATES'));
assert('A4 Select All', html.includes('multiSelectAllBtn'));
assert('A4 auto-save notes', html.includes('bindDetailNotes'));
assert('A4 stats filters', html.includes('setStatusFilter'));
assert('Magic link only', html.includes('signInWithOtp') && !html.includes('signInWithPassword'));
assert('Legal gate', html.includes('beta-legal-pg'));

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({ sprint: 'C1', result: failed.length ? 'FAIL' : 'PASS', passed, total: tests.length, failed: failed.map(f => f.name), tests }, null, 2));
process.exit(failed.length ? 1 : 0);
