/**
 * Sprint v1.4.0 — C2/C3/B5 mock metrics ONLY. No real client data.
 */
window.SPRINT_V140_MOCK = (function() {
  return {
    isMockDataOnly: true,
    noRealClientData: true,
    c2: {
      callsByClient: {
        'case-mock-1': 3, 'case-mock-2': 1, 'case-mock-3': 5, 'case-mock-4': 2,
        'case-mock-5': 0, 'case-mock-6': 4, 'case-mock-7': 1, 'case-mock-8': 2
      },
      followUpItems: [
        { clientId: 'case-mock-1', due: '2026-05-28', task: 'Demo callback — housing search', isMock: true },
        { clientId: 'case-mock-3', due: '2026-05-29', task: 'Demo document check', isMock: true },
        { clientId: 'case-mock-5', due: '2026-05-30', task: 'Demo landlord follow-up', isMock: true }
      ]
    },
    c3Metrics: {
      placements: 12,
      callsMade: 47,
      followUpsDue: 5,
      activeCases: 28,
      timeSavedHours: 14.5,
      statusBreakdown: { intake: 6, active: 12, follow_up: 5, placed: 12, on_hold: 3, closed: 2 },
      monthly: {
        monthLabel: 'May 2026',
        clientsProcessed: 3,
        placed: 2,
        pending: 1,
        successRatePct: 67
      }
    },
    b5Admin: {
      totalUsers: 1240,
      activeSessions: 18,
      feedbackCount: 86,
      featureUsage: [
        { name: 'Matches viewed', count: 4200, label: 'DEMO METRIC' },
        { name: 'Call Guide opens', count: 890, label: 'DEMO METRIC' },
        { name: 'Landlord Intel views', count: 210, label: 'INTERNAL PREVIEW' },
        { name: 'Case workspace opens', count: 45, label: 'INTERNAL PREVIEW' }
      ],
      systemHealth: { status: 'OK', uptime: '99.9% (demo)', label: 'TEST STATUS' },
      recentActivity: [
        { ts: '2026-05-26T10:00:00Z', action: 'Demo user signed in', masked: 'te***@leasesmart-demo.invalid' },
        { ts: '2026-05-26T09:45:00Z', action: 'Demo feedback submitted', masked: 'Category: UX' },
        { ts: '2026-05-26T09:30:00Z', action: 'Demo case note saved', masked: 'Client MOCK-NJ-2026-0001' }
      ]
    },
    b3UserDataCategories: [
      { id: 'profile', label: 'Profile & preferences', desc: 'Name, search prefs, placement type (demo copy on device)' },
      { id: 'favorites', label: 'Saved favorites', desc: 'Sample listing favorites stored locally' },
      { id: 'searches', label: 'Search history', desc: 'Recent demo searches on this device' },
      { id: 'feedback', label: 'Feedback submitted', desc: 'Beta feedback you sent from this browser' }
    ]
  };
})();
