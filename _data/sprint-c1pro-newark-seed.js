/**
 * Sprint C1-PRO / NEWARK-P2 — Placement Workbench sandbox seed (runtime global)
 *
 * Loaded as a window global (script tag) to match the LeaseSmart no-fetch
 * static-hosting pattern (works on file:// and GitHub Pages). No live APIs.
 *
 * SANDBOX ONLY. No real clients. No real landlords. No real addresses.
 * No map points. Dummy units, 555 contact numbers, compliance-safe labels only.
 *
 * The pure state-engine reducers that operate on this data live in
 * scripts/c1pro-workbench.mjs (Node-importable mirror) and inline in index.html
 * (browser runtime). Both share identical logic; the regression suite unit-tests
 * the .mjs version and asserts the inline version is present.
 */
window.SPRINT_C1PRO = (function() {
  var DISCLAIMER = 'Notice: Placement readiness analytics are automated decision-support tools. Final unit referrals must be processed in accordance with official agency guidelines.';

  // Placement stages a caseworker can toggle each unit through. Compliance-safe
  // wording only — no banned marketing terms. Models a realistic placement
  // pipeline from first review through move-in.
  var STAGES = ['Reviewing', 'Contacted', 'Tour Set', 'Application Submitted', 'Application Approved', 'Placed', 'On Hold'];

  // Application tracker (separate from placement pipeline) — per client+property.
  var APP_STATUSES = [
    'Not Started', 'Application Started', 'Submitted', 'Waiting for Response',
    'Documents Missing', 'Follow-Up Needed', 'Approved / Accepted', 'Denied / Passed', 'Placed'
  ];

  var DEMO_CLIENT = {
    id: 'client-marcus-demo',
    displayName: 'Marcus Johnson',
    readinessTenOfTen: 7,
    readinessLabel: 'Good Candidate'
  };

  // Units at or above this Placement Readiness Signal count as "Placement-Ready".
  var READY_THRESHOLD = 80;

  // Dummy sandbox units. zoneLabel is a display-only label (never a scoring
  // input). rentEstimate is a "Rent Within Standard Cap Estimates" figure.
  // resourceMatch uses the approved "Strong Resource Match" lexicon.
  // moveInReady / vouchersAccepted / accessibility / proximity are sandbox
  // placeholder context fields only (no real units, no real availability).
  var UNITS = [
    { id: 'asr-a', label: 'Active Sandbox Record A', zoneLabel: 'Zone 1 — Central Sandbox',  agencyRefId: 'SANDBOX-UNIT-A', bedrooms: 2, bathrooms: 1, unitType: 'Multi-family (demo)', rentEstimate: 1450, depositEstimate: 1450, readinessSignal: 92, resourceMatch: 'Strong Resource Match', contactPhone: '(555) 010-0142', moveInReady: 'Jun 2026', vouchersAccepted: 'Section 8 / HCV, VASH', accessibility: 'Step-free entry', proximity: '0.4 mi to client-specified resource vector', parking: 'Street (unassigned)', laundry: 'In-unit', lastSandboxReview: 'Demo — May 2026', unitSummary: 'Sandbox unit profile for caseworker walkthrough. Strong signal, central zone, voucher-friendly context.' },
    { id: 'asr-b', label: 'Active Sandbox Record B', zoneLabel: 'Zone 2 — North Sandbox',    agencyRefId: 'SANDBOX-UNIT-B', bedrooms: 1, bathrooms: 1, unitType: 'Garden-style (demo)', rentEstimate: 1190, depositEstimate: 1190, readinessSignal: 88, resourceMatch: 'Strong Resource Match', contactPhone: '(555) 010-0143', moveInReady: 'Jul 2026', vouchersAccepted: 'Section 8 / HCV', accessibility: 'Elevator access', proximity: '0.6 mi to client-specified resource vector', parking: 'Lot included', laundry: 'On-site', lastSandboxReview: 'Demo — May 2026', unitSummary: 'Compact 1BR sandbox record. Elevator building; good for single-adult placement demos.' },
    { id: 'asr-c', label: 'Active Sandbox Record C', zoneLabel: 'Zone 1 — Central Sandbox',  agencyRefId: 'SANDBOX-UNIT-C', bedrooms: 3, bathrooms: 2, unitType: 'Townhome-style (demo)', rentEstimate: 1825, depositEstimate: 1825, readinessSignal: 81, resourceMatch: 'Strong Resource Match', contactPhone: '(555) 010-0144', moveInReady: 'Aug 2026', vouchersAccepted: 'Section 8 / HCV, Rapid Re-Housing', accessibility: 'Ground floor', proximity: '0.9 mi to client-specified resource vector', parking: 'Driveway', laundry: 'In-unit', lastSandboxReview: 'Demo — May 2026', unitSummary: 'Larger household sandbox unit. Ground-floor access; multiple voucher programs accepted in demo.' },
    { id: 'asr-d', label: 'Active Sandbox Record D', zoneLabel: 'Zone 3 — East Sandbox',     agencyRefId: 'SANDBOX-UNIT-D', bedrooms: 2, bathrooms: 1, unitType: 'Walk-up (demo)', rentEstimate: 1540, depositEstimate: 1540, readinessSignal: 84, resourceMatch: 'Strong Resource Match', contactPhone: '(555) 010-0145', moveInReady: 'Jun 2026', vouchersAccepted: 'VASH', accessibility: 'Step-free entry', proximity: '1.1 mi to client-specified resource vector', parking: 'Street', laundry: 'Basement', lastSandboxReview: 'Demo — May 2026', unitSummary: 'VASH-oriented sandbox context. Step-free entry noted for mobility planning demos.' },
    { id: 'asr-e', label: 'Active Sandbox Record E', zoneLabel: 'Zone 2 — North Sandbox',    agencyRefId: 'SANDBOX-UNIT-E', bedrooms: 1, bathrooms: 1, unitType: 'Studio-adjacent 1BR (demo)', rentEstimate: 1075, depositEstimate: 1075, readinessSignal: 76, resourceMatch: 'Moderate Resource Match', contactPhone: '(555) 010-0146', moveInReady: 'Sep 2026', vouchersAccepted: 'Section 8 / HCV', accessibility: 'Walk-up (no elevator)', proximity: '1.3 mi to client-specified resource vector', parking: 'None listed', laundry: 'On-site', lastSandboxReview: 'Demo — May 2026', unitSummary: 'Moderate signal sandbox record. Useful for showing follow-up and stage progression in demos.' },
    { id: 'asr-f', label: 'Active Sandbox Record F', zoneLabel: 'Zone 4 — West Sandbox',     agencyRefId: 'SANDBOX-UNIT-F', bedrooms: 2, bathrooms: 1, unitType: 'Mid-rise (demo)', rentEstimate: 1610, depositEstimate: 1610, readinessSignal: 69, resourceMatch: 'Moderate Resource Match', contactPhone: '(555) 010-0147', moveInReady: 'Aug 2026', vouchersAccepted: 'Rapid Re-Housing', accessibility: 'Elevator access', proximity: '1.8 mi to client-specified resource vector', parking: 'Garage (waitlist)', laundry: 'In-building', lastSandboxReview: 'Demo — May 2026', unitSummary: 'Developing placement context. Farther from resource vector — good for proximity trade-off discussion.' },
    { id: 'asr-g', label: 'Active Sandbox Record G', zoneLabel: 'Zone 3 — East Sandbox',     agencyRefId: 'SANDBOX-UNIT-G', bedrooms: 4, bathrooms: 2, unitType: 'Large unit (demo)', rentEstimate: 2150, depositEstimate: 2150, readinessSignal: 58, resourceMatch: 'Developing Resource Match', contactPhone: '(555) 010-0148', moveInReady: 'Oct 2026', vouchersAccepted: 'Section 8 / HCV', accessibility: 'Ground floor', proximity: '2.4 mi to client-specified resource vector', parking: 'Driveway', laundry: 'In-unit', lastSandboxReview: 'Demo — May 2026', unitSummary: 'Family-size sandbox unit with lower readiness signal. Demonstrates hold/review paths.' }
  ];

  return {
    meta: {
      name: 'NEWARK-P2 Placement Workbench — Sandbox Seed',
      version: '1.0.0',
      build: '20260530-v2.13.0-c1pro-app',
      sandbox: true,
      noRealData: true,
      noRealAddresses: true,
      noMapPoints: true,
      noLiveApis: true,
      readyThreshold: READY_THRESHOLD,
      disclaimer: DISCLAIMER
    },
    stages: STAGES,
    appStatuses: APP_STATUSES,
    demoClient: DEMO_CLIENT,
    readyThreshold: READY_THRESHOLD,
    disclaimer: DISCLAIMER,
    units: UNITS
  };
})();
