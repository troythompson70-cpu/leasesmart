/**
 * Sprint C1-Pro — placement intelligence mock data ONLY
 * No real client/family data. Public-source-style samples for demo planning.
 * Not verified. Not guaranteed accurate.
 */
window.SPRINT_C1PRO_MOCK = (function() {
  var COUNTY_ZIP = {
    Essex: '07102',
    Passaic: '07501',
    Hudson: '07302',
    Bergen: '07601'
  };

  var TEN_FOR_TEN = [
    { id: 'housing_availability', label: 'Housing availability' },
    { id: 'program_voucher', label: 'Program and voucher fit' },
    { id: 'transportation', label: 'Transportation access' },
    { id: 'food_access', label: 'Food access' },
    { id: 'healthcare_pharmacy', label: 'Healthcare and pharmacy' },
    { id: 'school_daycare', label: 'Family school and daycare' },
    { id: 'safety_neighborhood', label: 'Safety and neighborhood' },
    { id: 'employment_workforce', label: 'Employment and workforce' },
    { id: 'community_support', label: 'Community and social support' },
    { id: 'daily_life', label: 'Daily life needs' }
  ];

  var DEFAULT_STATUSES = ['Found', 'Unknown', 'Needs Check'];

  function defaultChecklistForClient(clientId, placementType) {
    var items = {};
    var presets = {
      housing_availability: placementType === 'Family' ? 'Needs Check' : 'Unknown',
      program_voucher: 'Unknown',
      transportation: 'Found',
      food_access: 'Found',
      healthcare_pharmacy: 'Unknown',
      school_daycare: placementType === 'Family' ? 'Needs Check' : 'Unknown',
      safety_neighborhood: 'Unknown',
      employment_workforce: 'Unknown',
      community_support: 'Found',
      daily_life: 'Needs Check'
    };
    TEN_FOR_TEN.forEach(function(cat) {
      items[cat.id] = {
        status: presets[cat.id] || 'Unknown',
        publicNotes: 'Public source sample — replace with caseworker lookup. DEMO only.',
        cwNotes: ''
      };
    });
    return items;
  }

  function familyProfileForClient(i, placementType) {
    var isFamily = placementType === 'Family' || placementType === 'Families';
    return {
      adultsInHousehold: isFamily ? 2 : 1,
      childrenCount: isFamily ? 2 : 0,
      childrenAges: isFamily ? '7, 11' : '',
      bedroomRequirement: isFamily ? 3 : 1,
      schoolDistrictPreference: isFamily ? 'Newark Public Schools (demo preference)' : 'N/A — individual placement',
      petSituation: i % 3 === 0 ? 'One cat — demo only' : 'No pets',
      specialNeedsNote: 'Demo text note only — no real medical or disability data.'
    };
  }

  function areaResourcesForZip(zip, county) {
    var z = zip || '07102';
    return {
      zip: z,
      county: county || 'Essex',
      disclaimer: 'For planning purposes only. Public Source only. No accuracy guarantees.',
      sources: [
        { name: '211 NJ Directory', url: 'https://www.nj211.org/', type: '211 NJ' },
        { name: 'HUD Resource Locator', url: 'https://resources.hud.gov/', type: 'HUD' },
        { name: 'Places-style demo index', url: 'https://www.google.com/maps/search/near+' + z, type: 'Places demo link' }
      ],
      categories: {
        transit_stops: [
          { name: 'Demo Transit Hub A', detail: 'Bus/light rail — sample listing', source: '211 NJ Directory (Public Source)' },
          { name: 'Demo Transit Stop B', detail: 'NJ Transit sample stop', source: 'Public Source only — DEMO' }
        ],
        grocery_stores: [
          { name: 'Demo Grocery Market', detail: 'Within ~1 mi sample', source: 'Places-style demo (Public Source only)' },
          { name: 'Demo Fresh Foods', detail: 'Pantry-access friendly hours — sample', source: '211 NJ Directory (Public Source)' }
        ],
        clinics_pharmacies: [
          { name: 'Demo Community Clinic', detail: 'FQHC-style sample', source: 'HUD Resource Locator (Public Source)' },
          { name: 'Demo Pharmacy', detail: 'Retail pharmacy sample', source: 'Public Source only — DEMO' }
        ],
        schools_daycare: [
          { name: 'Demo Elementary School', detail: 'District sample — verify enrollment', source: 'Public Source only — DEMO' },
          { name: 'Demo Daycare Center', detail: 'Licensed center sample', source: '211 NJ Directory (Public Source)' }
        ],
        food_pantries: [
          { name: 'Demo Food Pantry', detail: 'Hours vary — call ahead sample', source: '211 NJ Directory (Public Source)' }
        ],
        community_orgs: [
          { name: 'Demo Housing Navigator Org', detail: 'Support services sample', source: 'HUD Resource Locator (Public Source)' },
          { name: 'Demo Workforce Center', detail: 'Employment support sample', source: '211 NJ Directory (Public Source)' }
        ]
      }
    };
  }

  var READINESS_ACTIONS = [
    'Review housing availability sources and update checklist',
    'Confirm program/voucher fit with public directory links',
    'Schedule follow-up call with landlord contact',
    'Complete family school/daycare Needs Check items',
    'Document transportation options from area snapshot'
  ];

  var MATCH_LABELS = ['Strong match', 'Good candidate', 'Needs review', 'Missing information', 'Contact needed', 'Not confirmed'];

  var DEMO_APARTMENT_MATCHES = [
    { id: 'dm-1', address: '123 Main St', rent: 1150, bedrooms: 1, tag: 'Pet OK', matchLabel: 'Strong match' },
    { id: 'dm-2', address: '456 Oak Ave', rent: 1200, bedrooms: 1, tag: 'Doorman', matchLabel: 'Good candidate' },
    { id: 'dm-3', address: '789 Pine Rd', rent: 1100, bedrooms: 1, tag: 'Transit nearby', matchLabel: 'Good candidate' },
    { id: 'dm-4', address: '22 Cedar Ln', rent: 1250, bedrooms: 1, tag: 'Pet OK', matchLabel: 'Needs review' },
    { id: 'dm-5', address: '500 Market St', rent: 1180, bedrooms: 1, tag: 'Laundry in unit', matchLabel: 'Good candidate' },
    { id: 'dm-6', address: '14 River Walk', rent: 1300, bedrooms: 1, tag: 'Doorman', matchLabel: 'Contact needed' },
    { id: 'dm-7', address: '88 Summit Ave', rent: 1050, bedrooms: 1, tag: 'Pet OK', matchLabel: 'Strong match' },
    { id: 'dm-8', address: '301 Broad St', rent: 1225, bedrooms: 1, tag: 'Parking included', matchLabel: 'Not confirmed' },
    { id: 'dm-9', address: '67 Grove St', rent: 1195, bedrooms: 1, tag: 'Near bus', matchLabel: 'Good candidate' },
    { id: 'dm-10', address: '910 Park Pl', rent: 1175, bedrooms: 1, tag: 'Pet OK', matchLabel: 'Missing information' }
  ];

  var DEMO_INTAKE_PROFILE = {
    displayName: 'Demo Client Marcus J.',
    clientType: 'Individual',
    bedrooms: 1,
    budgetMax: 1200,
    pets: true,
    city: 'Newark',
    state: 'NJ',
    program: 'Unknown / To Be Confirmed'
  };

  return {
    isMockDataOnly: true,
    noRealClientData: true,
    noVerifiedClaims: true,
    tenForTenCategories: TEN_FOR_TEN,
    statusOptions: DEFAULT_STATUSES,
    countyZipMap: COUNTY_ZIP,
    defaultChecklistForClient: defaultChecklistForClient,
    familyProfileForClient: familyProfileForClient,
    areaResourcesForZip: areaResourcesForZip,
    readinessActions: READINESS_ACTIONS,
    matchLabels: MATCH_LABELS,
    demoApartmentMatches: DEMO_APARTMENT_MATCHES,
    demoIntakeProfile: DEMO_INTAKE_PROFILE,
    publicSourceLinks: {
      nj211: 'https://www.nj211.org/',
      hudResources: 'https://resources.hud.gov/'
    }
  };
})();
