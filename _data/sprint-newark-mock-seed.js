/**
 * Sprint NEWARK — Placement Readiness sandbox registry (runtime global)
 *
 * Mirrors the canonical file: src/data/newark_sandbox_registry.json
 * Loaded as a window global (script tag) to match the LeaseSmart no-fetch
 * static-hosting pattern (works on file:// and GitHub Pages).
 *
 * SANDBOX ONLY. No real clients. No real addresses. No map points. No live APIs.
 * Neighborhood / zone labels are DISPLAY-ONLY and must never be used as a
 * scoring input. See NEWARK_PROHIBITED_FACTORS in index.html.
 */
window.SPRINT_NEWARK_MOCK = (function() {
  var DISCLAIMER = 'This is a demo support score based on sandbox data. Final placement decisions require caseworker review and agency approval.';

  // Fair-Housing-safe scoring categories. Each is computed ONLY from the
  // allowed intake fields below — never from protected-class attributes,
  // neighborhood demographics, or subjective safety labels.
  var SCORING_CATEGORIES = [
    { id: 'rent_fit', label: 'Rent / budget fit', max: 10 },
    { id: 'bedroom_fit', label: 'Bedroom / household size fit', max: 10 },
    { id: 'voucher_fit', label: 'Program / voucher fit', max: 10 },
    { id: 'resource_distance', label: 'Distance to resources (zone access)', max: 10 },
    { id: 'unit_need_fit', label: 'Stated housing-need / unit-feature fit', max: 10 },
    { id: 'info_completeness', label: 'Intake information completeness', max: 10 },
    { id: 'doc_readiness', label: 'Documentation readiness', max: 10 }
  ];

  // 10-for-10 framework = 7 scored categories above + these 3 review-only
  // categories. Review-only categories are shown for caseworker context only
  // and are never scored in the demo.
  var REVIEW_ONLY_CATEGORIES = [
    { id: 'employment_workforce', label: 'Employment / workforce access' },
    { id: 'community_support', label: 'Community / social support' },
    { id: 'daily_life', label: 'Daily-life needs' }
  ];

  // Voucher / program options offered in the intake form (demo list).
  var VOUCHER_OPTIONS = [
    'Section 8 / HCV',
    'SRAP',
    'HASP',
    'VASH',
    'None / Market',
    'Unknown / To be confirmed'
  ];

  // Functional unit-need options. These describe UNIT FEATURES and proximity,
  // not protected characteristics. "Ground floor" / "elevator" are functional
  // accessibility preferences a client can request, not a disability label.
  var NEED_OPTIONS = [
    'ground floor',
    'elevator building',
    'near transit',
    'near grocery',
    'near clinic',
    'near school',
    'near food access',
    'laundry on site'
  ];

  var REGISTRY = {
    meta: {
      name: 'Newark Placement Readiness — Sandbox Registry',
      version: '1.0.0',
      sandbox: true,
      noRealData: true,
      noRealAddresses: true,
      noLatLong: true,
      noLiveApis: true,
      displayOnlyFields: ['neighborhoodLabel'],
      scoringDisclaimer: DISCLAIMER
    },
    zones: [
      {
        id: 'central-newark', label: 'Central Newark Resource Zone',
        resourceAccessScore: 0.9, resourceAccessLabel: 'High',
        resources: {
          transit: [{ name: 'Demo Transit Hub', detail: 'Bus + light rail sample — verify with NJ Transit', source: 'Public-source style sample (DEMO)' }],
          grocery: [{ name: 'Demo Community Grocery', detail: 'Full-service sample within zone', source: 'Public-source style sample (DEMO)' }],
          clinics: [{ name: 'Demo Community Clinic', detail: 'FQHC-style sample', source: 'Public-source style sample (DEMO)' }],
          schools: [{ name: 'Demo Elementary School', detail: 'District sample — verify enrollment', source: 'Public-source style sample (DEMO)' }],
          support: [{ name: 'Demo Housing Navigator Org', detail: 'Placement support sample', source: 'Public-source style sample (DEMO)' }]
        }
      },
      {
        id: 'ferry-street', label: 'Ferry Street Corridor',
        resourceAccessScore: 0.75, resourceAccessLabel: 'Medium-High',
        resources: {
          transit: [{ name: 'Demo Corridor Bus Stop', detail: 'Frequent-service sample stop', source: 'Public-source style sample (DEMO)' }],
          grocery: [{ name: 'Demo Market & Pantry', detail: 'Grocery + food pantry hours sample', source: 'Public-source style sample (DEMO)' }],
          clinics: [{ name: 'Demo Pharmacy', detail: 'Retail pharmacy sample', source: 'Public-source style sample (DEMO)' }],
          schools: [{ name: 'Demo Daycare Center', detail: 'Licensed center sample', source: 'Public-source style sample (DEMO)' }],
          support: [{ name: 'Demo Workforce Center', detail: 'Employment support sample', source: 'Public-source style sample (DEMO)' }]
        }
      },
      {
        id: 'bergen-street', label: 'Bergen Street Health Resource Zone',
        resourceAccessScore: 0.6, resourceAccessLabel: 'Medium',
        resources: {
          transit: [{ name: 'Demo Local Bus Line', detail: 'Local-service sample', source: 'Public-source style sample (DEMO)' }],
          grocery: [{ name: 'Demo Fresh Foods', detail: 'Grocery sample within zone', source: 'Public-source style sample (DEMO)' }],
          clinics: [
            { name: 'Demo Health Center', detail: 'Primary care + behavioral health sample', source: 'Public-source style sample (DEMO)' },
            { name: 'Demo Specialty Clinic', detail: 'Health-resource concentration sample', source: 'Public-source style sample (DEMO)' }
          ],
          schools: [{ name: 'Demo Charter School', detail: 'District sample — verify enrollment', source: 'Public-source style sample (DEMO)' }],
          support: [{ name: 'Demo Community Health Org', detail: 'Care coordination sample', source: 'Public-source style sample (DEMO)' }]
        }
      }
    ],
    properties: [
      { id: 'np-1', zoneId: 'central-newark', neighborhoodLabel: 'Central Newark Resource Zone', bedrooms: 1, rent: 1150, acceptsVouchers: ['Section 8 / HCV', 'SRAP'], unitFeatures: ['near transit', 'near grocery', 'laundry on site'] },
      { id: 'np-2', zoneId: 'central-newark', neighborhoodLabel: 'Central Newark Resource Zone', bedrooms: 2, rent: 1450, acceptsVouchers: ['Section 8 / HCV', 'VASH'], unitFeatures: ['ground floor', 'near transit', 'near clinic'] },
      { id: 'np-3', zoneId: 'central-newark', neighborhoodLabel: 'Central Newark Resource Zone', bedrooms: 3, rent: 1850, acceptsVouchers: ['Section 8 / HCV'], unitFeatures: ['near school', 'near grocery'] },
      { id: 'np-4', zoneId: 'ferry-street', neighborhoodLabel: 'Ferry Street Corridor', bedrooms: 1, rent: 1250, acceptsVouchers: ['Section 8 / HCV', 'SRAP', 'HASP'], unitFeatures: ['near transit', 'near food access'] },
      { id: 'np-5', zoneId: 'ferry-street', neighborhoodLabel: 'Ferry Street Corridor', bedrooms: 2, rent: 1550, acceptsVouchers: ['Section 8 / HCV'], unitFeatures: ['elevator building', 'near transit', 'near grocery'] },
      { id: 'np-6', zoneId: 'ferry-street', neighborhoodLabel: 'Ferry Street Corridor', bedrooms: 0, rent: 980, acceptsVouchers: ['None / Market', 'SRAP'], unitFeatures: ['near transit'] },
      { id: 'np-7', zoneId: 'bergen-street', neighborhoodLabel: 'Bergen Street Health Resource Zone', bedrooms: 2, rent: 1500, acceptsVouchers: ['Section 8 / HCV', 'VASH'], unitFeatures: ['ground floor', 'near clinic'] },
      { id: 'np-8', zoneId: 'bergen-street', neighborhoodLabel: 'Bergen Street Health Resource Zone', bedrooms: 3, rent: 1900, acceptsVouchers: ['Section 8 / HCV'], unitFeatures: ['near clinic', 'near school'] },
      { id: 'np-9', zoneId: 'bergen-street', neighborhoodLabel: 'Bergen Street Health Resource Zone', bedrooms: 1, rent: 1200, acceptsVouchers: ['Section 8 / HCV', 'HASP'], unitFeatures: ['elevator building', 'near clinic', 'near transit'] },
      { id: 'np-10', zoneId: 'central-newark', neighborhoodLabel: 'Central Newark Resource Zone', bedrooms: 4, rent: 2200, acceptsVouchers: ['Section 8 / HCV'], unitFeatures: ['near school', 'near grocery', 'laundry on site'] }
    ]
  };

  return {
    isMockDataOnly: true,
    noRealClientData: true,
    noRealAddresses: true,
    noLatLong: true,
    noLiveApis: true,
    disclaimer: DISCLAIMER,
    scoringCategories: SCORING_CATEGORIES,
    reviewOnlyCategories: REVIEW_ONLY_CATEGORIES,
    voucherOptions: VOUCHER_OPTIONS,
    needOptions: NEED_OPTIONS,
    registry: REGISTRY
  };
})();
