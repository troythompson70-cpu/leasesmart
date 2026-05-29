/**
 * Sprint AUTH-1 — demo organizations/staff ONLY. No real shelter data.
 * Passwords use Supabase Auth when configured; demo sandbox uses local session only.
 */
window.SPRINT_AUTH1_MOCK = (function() {
  var ORG_JEROME = {
    id: 'org-demo-jerome-ymca-001',
    name: 'Demo YMCA Newark Placement Sandbox',
    slug: 'demo-jerome-ymca',
    sandbox_mode: true,
    isMock: true
  };
  var staff = [
    { id: 'staff-demo-platform-1', organizationId: null, email: 'platform.admin@leasesmart-demo.invalid', fullName: 'Demo Platform Admin (Troy)', role: 'platform_admin', isActive: true, isMock: true },
    { id: 'staff-demo-jerome-1', organizationId: ORG_JEROME.id, email: 'org.admin@leasesmart-demo.invalid', fullName: 'Demo Org Admin (Jerome)', role: 'admin', isActive: true, isMock: true },
    { id: 'staff-demo-super-1', organizationId: ORG_JEROME.id, email: 'supervisor@leasesmart-demo.invalid', fullName: 'Demo Supervisor', role: 'supervisor', isActive: true, isMock: true },
    { id: 'staff-demo-cm-1', organizationId: ORG_JEROME.id, email: 'caseworker@leasesmart-demo.invalid', fullName: 'Demo Case Manager Staff', role: 'case_manager', isActive: true, isMock: true },
    { id: 'staff-demo-viewer-1', organizationId: ORG_JEROME.id, email: 'viewer@leasesmart-demo.invalid', fullName: 'Demo Viewer', role: 'viewer', isActive: true, isMock: true }
  ];
  var pendingInvites = [
    { id: 'inv-demo-1', organizationId: ORG_JEROME.id, email: 'pending.staff@leasesmart-demo.invalid', role: 'case_manager', status: 'pending', expiresInHours: 1, isMock: true }
  ];
  return {
    isMockDataOnly: true,
    noRealClientData: true,
    organizations: [ORG_JEROME],
    staff: staff,
    pendingInvites: pendingInvites,
    demoLoginHint: 'Demo sandbox — use buttons below when Supabase is not configured. Never use real client emails.'
  };
})();
