/**
 * Sprint E1 — mock config, HUD FMR, benefits dummy households (no PII)
 */
window.SPRINT_E1_MOCK = {
  buildId: '20260526-v2.3.0-e1',
  noPii: true,
  noVerifiedClaims: true,
  hudFmrYear: 2026,
  hudFmrLabel: 'HUD 2026 Fair Market Rate',
  hudFmrUrl: 'https://www.huduser.gov/portal/datasets/fmr.html',
  nycBenefitsUrl: 'https://www.nyc.gov/site/opportunity/index.page',
  programCountLabel: '40+ programs',
  targetCounties: ['Essex', 'Passaic', 'Hudson', 'Bergen', 'Union'],
  dummyHouseholds: [
    { id: 'hh-demo-1', household_size: 1, income_band: 'low' },
    { id: 'hh-demo-2', household_size: 3, income_band: 'low' },
    { id: 'hh-demo-3', household_size: 2, income_band: 'moderate' },
    { id: 'hh-demo-4', household_size: 4, income_band: 'low' }
  ]
};

function e1SeedIfNeeded() { /* config marker */ }
