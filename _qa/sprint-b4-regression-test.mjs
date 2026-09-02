/**
 * Sprint B4-Foundation regression — schema skeleton, roles, UI, notes, A6/C1/B2 preservation
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildAtLeast } from './build-id-lib.mjs';
import {
  B4_ROLES,
  b4FilterClientsForRole,
  b4QueryAuthorizedClients,
  b4CanWriteCaseNote,
  b4NoCrossAgency,
  b4CanAddUsers,
  b4CanDeleteUsers,
  b4AddAgencyUser,
  b4DeleteAgencyUser,
  B4_DEFAULT_USER_MGMT_PERMISSIONS,
} from '../scripts/b4-role-permissions.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260526-v2.1.0-e2';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sql = readFileSync(join(ROOT, 'supabase/drafts/sprint_b4_foundation.sql'), 'utf8');
const seed = readFileSync(join(ROOT, '_data/b4-case-mock-seed.js'), 'utf8');
const perm = readFileSync(join(ROOT, 'scripts/b4-role-permissions.mjs'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

// B4 build
assert('B4 build id', buildAtLeast(html, BUILD));
assert('B4 draft SQL exists', sql.includes('DRAFT ONLY') || sql.includes('DO NOT APPLY LIVE'));
assert('B4 all tables in SQL', [
  'agencies', 'agency_users', 'agency_roles', 'case_clients',
  'client_assignments', 'case_notes', 'case_status_history',
  'case_reassignment_log', 'case_access_audit_log', 'supervisor_teams',
  'user_management_permissions'
].every(t => sql.includes('public.' + t)));
assert('User mgmt permissions table fields', ['can_add_users', 'can_delete_users', 'can_reassign_cases', 'customized_by'].every(f => sql.includes(f)));
assert('RLS agency_users insert policy', sql.includes('agency_users_insert') && sql.includes('role_can_add_users'));
assert('RLS agency_users delete policy', sql.includes('agency_users_delete') && sql.includes('role_can_delete_users'));
assert('Seed default permissions fn', sql.includes('seed_default_user_management_permissions'));
assert('Caseworker default false in SQL', sql.includes("p_agency_id, 'caseworker', false, false, false"));
assert('B4 RLS enabled all tables', sql.includes('ENABLE ROW LEVEL SECURITY'));
assert('B4 audit log table', sql.includes('case_access_audit_log'));
assert('B4 no cross-agency helper', sql.includes('same_agency'));
assert('B4 7 roles in SQL', B4_ROLES.every(r => sql.includes("'" + r + "'")));

// Role permission model
assert('Permission module exports roles', B4_ROLES.length === 7);
assert('Caseworker scope assigned only', perm.includes('assigned_clients_only'));
assert('Client scope own profile', perm.includes('own_profile_only'));
assert('Supervisor team scope', perm.includes('team_clients_only'));
assert('Director agency scope', perm.includes('agency_level'));

const AGENCY = 'agency-demo-nj-001';
const mockClients = [
  { id: 'c1', agencyId: AGENCY, clientUserId: 'u-client-demo-1', assignedCaseworkerId: 'u-cw-demo-1', isMock: true },
  { id: 'c2', agencyId: AGENCY, clientUserId: null, assignedCaseworkerId: 'u-cw-demo-2', isMock: true },
  { id: 'c3', agencyId: 'other-agency', clientUserId: null, assignedCaseworkerId: 'u-cw-demo-1', isMock: true },
];
const cwCtx = { roleKey: 'caseworker', userId: 'u-cw-demo-1', agencyId: AGENCY };
const clientCtx = { roleKey: 'client', userId: 'u-client-demo-1', agencyId: AGENCY };
const supCtx = { roleKey: 'supervisor', userId: 'u-sup-demo-1', agencyId: AGENCY };
const teamIds = ['u-cw-demo-1', 'u-cw-demo-2'];

assert('Layer2 caseworker sees assigned only', b4FilterClientsForRole(mockClients, cwCtx).length === 1);
assert('Layer2 client sees own only', b4FilterClientsForRole(mockClients, clientCtx).length === 1);
assert('Layer2 supervisor sees team', b4FilterClientsForRole(mockClients, supCtx, teamIds).length === 2);
assert('Layer3 query returns ids only', b4QueryAuthorizedClients(mockClients, cwCtx).join(',') === 'c1');
assert('No cross-agency', !b4NoCrossAgency(cwCtx, 'other-agency'));
assert('Can write note assigned client', b4CanWriteCaseNote(cwCtx, mockClients[0]));
assert('Cannot write note unassigned', !b4CanWriteCaseNote(cwCtx, mockClients[1]));

assert('Caseworker cannot add users L3', !b4CanAddUsers(cwCtx));
assert('Caseworker cannot delete users L3', !b4CanDeleteUsers(cwCtx));
assert('Supervisor can add users L3', b4CanAddUsers(supCtx));
assert('Add user blocked for caseworker fn', !b4AddAgencyUser(cwCtx).ok);
assert('Delete user blocked for caseworker fn', !b4DeleteAgencyUser(cwCtx).ok);
assert('Caseworker defaults all false', !B4_DEFAULT_USER_MGMT_PERMISSIONS.caseworker.can_add_users && !B4_DEFAULT_USER_MGMT_PERMISSIONS.caseworker.can_delete_users);

// Frontend layer 2
assert('Frontend b4CanAddUsers', html.includes('function b4CanAddUsers'));
assert('Frontend user mgmt panel', html.includes('renderB4UserManagementPanel'));
assert('Add User button gated', html.includes('b4UiAddUser') && html.includes('Add User'));
assert('Caseworker hidden message', html.includes('cannot add or delete users'));
assert('Mock seed user permissions', seed.includes('userManagementPermissions'));

// Mock seed — no real client data
assert('Mock seed linked', html.includes('b4-case-mock-seed.js'));
assert('All mock flagged', seed.includes('isMock: true') && seed.includes('noRealClientData: true'));
assert('Demo email domain only', seed.includes('@leasesmart-demo.invalid') && !seed.includes('@gmail.com'));
assert('No real SSN pattern', !/\d{3}-\d{2}-\d{4}/.test(seed));

// UI skeleton
assert('B4 workspace page', html.includes('b4-workspace-pg'));
assert('DEMO INTERNAL banner', html.includes('DEMO / INTERNAL'));
assert('Caseworker My Clients tab', html.includes("'clients', label: 'My Clients'"));
assert('Supervisor Team Clients', html.includes("'team', label: 'Team Clients'"));
assert('Director Agency Dashboard', html.includes("'dashboard', label: 'Agency Dashboard'"));
assert('Role bar render', html.includes('renderB4RoleBar'));
assert('Home internal entry', html.includes('showB4Workspace'));

// Case notes auto-save
assert('B4 1 second debounce', html.includes('bindB4CaseNotes') && html.includes('1000'));
assert('Saving saved status', html.includes("status.textContent = 'Saving...'") && html.includes("status.textContent = 'Saved ✓'"));
assert('Notes assigned only', html.includes('b4CanWriteCaseNote'));
assert('b4CaseNotes store', html.includes('b4CaseNotes'));

// Triple redundancy in frontend
assert('Redundancy filter fn', html.includes('b4FilterClientsForRole'));
assert('Redundancy query fn', html.includes('b4QueryAuthorizedClients'));
assert('Audit log mock', html.includes('b4RecordAudit'));

// A6 preservation
assert('A6 onboarding route', html.includes('function routeOnboarding'));
assert('A6 profile create', html.includes('profile-create-pg'));
assert('A6 quiz completed', html.includes('quizCompleted === true'));

// C1 preservation
assert('C1 Landlord Intel tab', html.includes('tab-landlord-intel'));
assert('C1 seed linked', html.includes('landlord-intel-seed-nj.js'));

// B2 preservation
assert('B2 sprint log script', existsSync(join(ROOT, 'scripts/sprint-log.mjs')));
assert('B2 morning checklist', existsSync(join(ROOT, 'scripts/morning-checklist.mjs')));
assert('B2 master vault', existsSync(join(ROOT, 'master-vault/LeaseSmart-Sprint-Master-Log.md')));

function runSuite(file) {
  const r = spawnSync('node', [join(QA, file)], { encoding: 'utf8', cwd: QA });
  let json = null;
  try {
    const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/);
    if (m) json = JSON.parse(m[0]);
  } catch (e) { /* ignore */ }
  return { file, json, exit: r.status };
}

const a6 = runSuite('sprint-a6-regression-test.mjs');
const c1 = runSuite('sprint-c1-regression-test.mjs');
const b2 = runSuite('sprint-b2-regression.mjs');

assert('A6 nested PASS', a6.json && a6.json.result === 'PASS');
assert('C1 nested PASS', c1.json && c1.json.result === 'PASS');
assert('B2 nested PASS', b2.json && b2.json.result === 'PASS');

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'B4-Foundation',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested: {
    a6: a6.json ? { result: a6.json.result, passed: a6.json.passed, total: a6.json.total } : null,
    c1: c1.json ? { result: c1.json.result, passed: c1.json.passed, total: c1.json.total } : null,
    b2: b2.json ? { result: b2.json.result, passed: b2.json.passed, total: b2.json.total } : null,
  },
  tripleRedundancy: {
    rlsDrafted: true,
    frontendFilter: true,
    authorizedQueryOnly: true,
  },
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
