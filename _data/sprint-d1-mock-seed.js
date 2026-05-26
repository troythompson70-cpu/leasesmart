/**
 * Sprint D1 — dummy in-app notifications and follow-up fixtures
 */
window.SPRINT_D1_MOCK = (function() {
  var today = new Date();
  function isoOffset(days) {
    var d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  return {
    isMockDataOnly: true,
    dummyNotifications: [
      { id: 'd1-n-1', title: 'Case assigned', message: 'Demo Client A assigned to you (MOCK)', alert_type: 'case_assigned', is_read: false, isMock: true },
      { id: 'd1-n-2', title: 'Follow-up due today', message: 'Callback for MOCK-NJ-2026-0001 due today', alert_type: 'follow_up_due', is_read: false, isMock: true },
      { id: 'd1-n-3', title: 'Case status changed', message: 'Demo Client C moved to follow_up (MOCK)', alert_type: 'status_changed', is_read: true, isMock: true },
      { id: 'd1-n-4', title: 'Follow-up overdue', message: 'Document check overdue for MOCK-NJ-2026-0002 (MOCK)', alert_type: 'overdue_follow_up', is_read: false, isMock: true }
    ],
    followUpSchedule: [
      { clientId: 'case-mock-1', due: isoOffset(0), task: 'Demo callback — due TODAY', isMock: true },
      { clientId: 'case-mock-2', due: isoOffset(-2), task: 'Demo document check — OVERDUE', isMock: true },
      { clientId: 'case-mock-3', due: isoOffset(1), task: 'Demo landlord follow-up — upcoming', isMock: true },
      { clientId: 'case-mock-5', due: isoOffset(-1), task: 'Demo intake review — OVERDUE', isMock: true }
    ]
  };
})();
