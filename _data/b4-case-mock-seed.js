/**
 * Sprint B4-Foundation — mock case management data ONLY
 * No real client PII. All records flagged isMock: true.
 * Email domain: @leasesmart-demo.invalid
 */
window.B4_MOCK_FOUNDATION = (function() {
  var AGENCY_ID = 'agency-demo-nj-001';
  var users = [
    { id: 'u-client-demo-1', agencyId: AGENCY_ID, roleKey: 'client', name: 'Demo Client Avery', email: 'avery.demo@leasesmart-demo.invalid' },
    { id: 'u-cw-demo-1', agencyId: AGENCY_ID, roleKey: 'caseworker', name: 'Demo Caseworker Sam', email: 'sam.cw@leasesmart-demo.invalid', supervisorId: 'u-sup-demo-1' },
    { id: 'u-cw-demo-2', agencyId: AGENCY_ID, roleKey: 'caseworker', name: 'Demo Caseworker Riley', email: 'riley.cw@leasesmart-demo.invalid', supervisorId: 'u-sup-demo-1' },
    { id: 'u-sup-demo-1', agencyId: AGENCY_ID, roleKey: 'supervisor', name: 'Demo Supervisor Jordan', email: 'jordan.sup@leasesmart-demo.invalid' },
    { id: 'u-dir-demo-1', agencyId: AGENCY_ID, roleKey: 'director', name: 'Demo Director Morgan', email: 'morgan.dir@leasesmart-demo.invalid' },
    { id: 'u-mgr-demo-1', agencyId: AGENCY_ID, roleKey: 'manager', name: 'Demo Manager Casey', email: 'casey.mgr@leasesmart-demo.invalid' },
    { id: 'u-admin-demo-1', agencyId: AGENCY_ID, roleKey: 'agency_admin', name: 'Demo Agency Admin', email: 'admin@leasesmart-demo.invalid' }
  ];
  var supervisorTeams = [
    { supervisorUserId: 'u-sup-demo-1', memberUserId: 'u-cw-demo-1' },
    { supervisorUserId: 'u-sup-demo-1', memberUserId: 'u-cw-demo-2' }
  ];
  var statuses = ['intake', 'active', 'follow_up', 'placed', 'on_hold'];
  var clients = [];
  for (var i = 1; i <= 8; i++) {
    var cw = i <= 4 ? 'u-cw-demo-1' : 'u-cw-demo-2';
    clients.push({
      id: 'case-mock-' + i,
      agencyId: AGENCY_ID,
      clientUserId: i === 1 ? 'u-client-demo-1' : null,
      displayName: 'Demo Client ' + String.fromCharCode(64 + i),
      caseNumber: 'MOCK-NJ-2026-' + String(i).padStart(4, '0'),
      status: statuses[i % statuses.length],
      placementType: i % 2 === 0 ? 'Individual' : 'Family',
      assignedCaseworkerId: cw,
      followUpDue: i % 3 === 0 ? '2026-05-28' : null,
      isMock: true,
      county: ['Essex', 'Passaic', 'Hudson', 'Bergen'][i % 4]
    });
  }
  return {
    agency: { id: AGENCY_ID, name: 'Demo Housing Alliance NJ', slug: 'demo-housing-nj', isMock: true },
    users: users,
    supervisorTeams: supervisorTeams,
    clients: clients,
    isMockDataOnly: true,
    noRealClientData: true
  };
})();
