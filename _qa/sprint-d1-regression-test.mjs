/**
 * Sprint D1 — email notifications, follow-up reminders, in-app panel + all prior suites
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  d1IsEmailServiceLive,
  d1QueueEmail,
  D1_EMAIL_TYPES,
} from '../scripts/d1-email-notifications.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260526-v1.5.0-d1';
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sql = readFileSync(join(ROOT, 'supabase/drafts/sprint_d1_notifications.sql'), 'utf8');
const seed = readFileSync(join(ROOT, '_data/sprint-d1-mock-seed.js'), 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

const buildMatch = html.match(/LS_BUILD = '([^']+)'/);
assert('D1 build id preserved or superseded', buildMatch && /^20260526-v1\.(5\.0-d1|6\.0-d2|8\.0-d4|9\.0-d5)$|^20260526-v2\.(0\.0-d3|1\.0-e2)$/.test(buildMatch[1]));
assert('D1 mock seed linked', html.includes('sprint-d1-mock-seed.js'));
assert('D1 draft SQL', sql.includes('DRAFT ONLY') || sql.includes('notification_outbox'));
assert('D1 outbox table', sql.includes('notification_outbox'));
assert('D1 in_app_notifications table', sql.includes('in_app_notifications'));
assert('D1 email types in SQL', ['caseworker_assigned', 'case_status_changed', 'follow_up_overdue'].every(t => sql.includes(t)));

// Email module
assert('D1 email types export', D1_EMAIL_TYPES.length === 3);
assert('D1 follow_up_overdue email', D1_EMAIL_TYPES.includes('follow_up_overdue'));
assert('D1 placeholder when not live', !d1IsEmailServiceLive({}) && d1QueueEmail({}, 'caseworker_assigned', { clientName: 'Demo' }).status === 'skipped_no_email_service');
assert('D1 email draft flag', d1QueueEmail({}, 'case_status_changed', {}).draft === true);
assert('D1 overdue email payload', d1QueueEmail({}, 'follow_up_overdue', { caseNumber: 'MOCK-1' }).subject.includes('overdue'));

// Agent 1 — in-app panel + email triggers in UI
assert('d1NotifyCaseworkerAssigned', html.includes('function d1NotifyCaseworkerAssigned'));
assert('d1NotifyFollowUpOverdue', html.includes('function d1NotifyFollowUpOverdue'));
assert('d1NotifyUserStatusChange', html.includes('function d1NotifyUserStatusChange'));
assert('d1QueueEmail in app', html.includes('function d1QueueEmail'));
assert('d1EmailOutbox store', html.includes('d1EmailOutbox'));
assert('skipped_no_email_service', html.includes('skipped_no_email_service'));
assert('notification types in seed', ['case_assigned', 'status_changed', 'follow_up_due', 'overdue_follow_up'].every(t => seed.includes(t)));

// Agent 2 — follow-up reminders
assert('d1GetFollowUpCounts', html.includes('function d1GetFollowUpCounts'));
assert('d1RefreshFollowUpHeader', html.includes('function d1RefreshFollowUpHeader'));
assert('c2FollowUpHeader', html.includes('c2FollowUpHeader'));
assert('dashFollowUpBar', html.includes('dashFollowUpBar'));
assert('bell follow-up badge', html.includes('ls-notif-badge-overdue'));
assert('OVERDUE flag', html.includes('ls-followup-overdue'));
assert('DUE TODAY flag', html.includes('DUE TODAY'));
assert('followUpSchedule in seed', seed.includes('followUpSchedule'));

// Agent 3 — in-app panel UI
assert('Notification bell', html.includes('ls-notif-bell'));
assert('d1ToggleNotificationPanel', html.includes('function d1ToggleNotificationPanel'));
assert('d1MarkNotificationRead', html.includes('function d1MarkNotificationRead'));
assert('d1ClearAllNotifications', html.includes('function d1ClearAllNotifications'));
assert('dashNotifBell', html.includes('dashNotifBell'));
assert('c2NotifBell', html.includes('c2NotifBell'));
assert('inAppNotifications store', html.includes('inAppNotifications'));
assert('dummy notifications seed', seed.includes('dummyNotifications'));

// Preservation spot checks
assert('A6 onboarding', html.includes('function routeOnboarding'));
assert('C1 landlord', html.includes('tab-landlord-intel'));
assert('B4 permissions', html.includes('b4CanAddUsers'));
assert('C2 workspace', html.includes('c2-case-pg'));
assert('C3 reporting', html.includes('c3-reporting-pg'));
assert('B5 platform', html.includes('b5-platform-pg'));
assert('B3 user data', html.includes('b3-user-data-pg'));

function runSuite(file) {
  const r = spawnSync('node', [join(QA, file)], { encoding: 'utf8', cwd: QA });
  let json = null;
  try {
    const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/);
    if (m) json = JSON.parse(m[0]);
  } catch (e) { /* ignore */ }
  return { file, json, exit: r.status };
}

const nestedFiles = [
  'sprint-a6-regression-test.mjs',
  'sprint-c1-regression-test.mjs',
  'sprint-b2-regression.mjs',
  'sprint-b4-regression-test.mjs',
  'sprint-v140-regression-test.mjs',
];
const nested = {};
nestedFiles.forEach(function(f) {
  const r = runSuite(f);
  nested[f] = r.json ? { result: r.json.result, passed: r.json.passed, total: r.json.total } : { result: 'FAIL' };
  assert(f + ' PASS', r.json && r.json.result === 'PASS');
});

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'D1',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
