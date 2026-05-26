/**
 * Sprint D2 — saved search alerts, contact history fixtures, program compatibility
 */
window.SPRINT_D2_MOCK = (function() {
  var PROGRAMS = ['Section 8', 'Voucher Ready', 'Credit Flexible', 'Market Rate', 'Unknown'];
  return {
    isMockDataOnly: true,
    programCompatibilityTypes: PROGRAMS,
    availabilityFilterOptions: ['Units Available', 'Waitlist', 'Unknown', 'No Availability', 'Call for Availability'],
    savedSearchProfiles: [
      {
        id: 'd2-sp-demo-1',
        name: 'Essex — Section 8 available',
        filters: { county: 'Essex', verification: '', availability: 'Units Available', program: 'Section 8' },
        seenIds: ['li-nj-1', 'li-nj-2', 'li-nj-3'],
        isMock: true
      },
      {
        id: 'd2-sp-demo-2',
        name: 'Hudson — voucher ready',
        filters: { county: 'Hudson', verification: 'Contact Verified', availability: '', program: 'Voucher Ready' },
        seenIds: ['li-nj-11'],
        isMock: true
      }
    ],
    mockNewListingAlerts: [
      {
        profileId: 'd2-sp-demo-1',
        landlordId: 'li-nj-7',
        title: 'New Essex Section 8 match',
        message: 'Demo: Essex Sample Apartments — Units Available (MOCK)'
      },
      {
        profileId: 'd2-sp-demo-2',
        landlordId: 'li-nj-15',
        title: 'New Hudson voucher match',
        message: 'Demo: Jersey City property — Contact Verified (MOCK)'
      }
    ],
    contactHistorySeed: {
      'li-nj-1': [
        { id: 'ch-seed-1', contact_date: '2026-05-18', method: 'Phone', outcome: 'No Answer', notes: 'Demo voicemail left (MOCK)', isMock: true },
        { id: 'ch-seed-2', contact_date: '2026-05-20', method: 'Email', outcome: 'Left Message', notes: 'Sent availability inquiry — demo only', isMock: true }
      ],
      'li-nj-2': [
        { id: 'ch-seed-3', contact_date: '2026-05-22', method: 'In Person', outcome: 'Spoke With', notes: 'Demo site visit — units discussed', isMock: true }
      ]
    },
    contactMethods: ['Phone', 'Email', 'In Person', 'Other'],
    contactOutcomes: ['No Answer', 'Left Message', 'Spoke With', 'Confirmed Available', 'Not Available', 'Bad Number']
  };
})();
