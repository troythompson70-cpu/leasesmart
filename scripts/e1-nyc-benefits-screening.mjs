/**
 * Sprint E1 — NYC Benefits Platform screening skeleton (demo — no PII)
 */
export const E1_NYC_BENEFITS_URL = 'https://www.nyc.gov/site/opportunity/index.page';
export const E1_BENEFITS_DRAFT_LABEL = 'DRAFT — Demo household screening only';

export const E1_NYC_PROGRAMS = [
  'SNAP', 'Cash Assistance', 'Section 8', 'HEAP', 'WIC', 'Medicaid', 'Child Care',
  'NYCHA Public Housing', 'CityFHEPS', 'Rental Assistance', 'Senior Housing',
  'Disability Benefits', 'TANF', 'SSI', 'LIHEAP', 'Homelessness Prevention',
  'Rapid Rehousing', 'Supportive Housing', 'HRA One-Shot Deal', 'Family Eviction Prevention',
  'Tenant Legal Services', 'School Meals', 'Workforce Training', 'Legal Aid Housing',
  'Veterans Benefits', 'Unemployment', 'Earned Income Tax Credit', 'Summer Youth Employment',
  'Domestic Violence Shelter', 'Weatherization', 'Affordable Connectivity', 'Community Health',
  'Mental Health Mobile', 'Substance Use Support', 'Employment Works', 'Immigrant Resource',
  'Youth Shelter', 'Adult Protective Services', 'Food Pantry Network', 'Women Infants Children Plus',
  'Housing Court Assistance', 'Advantage Program', 'Supportive Housing Plus',
];

export function e1ValidateHouseholdNoPii(household) {
  if (!household) return false;
  const forbidden = ['name', 'ssn', 'email', 'phone', 'address', 'dob'];
  return forbidden.every(function(k) { return household[k] === undefined; });
}

export function e1ScreenDummyHousehold(household) {
  if (!e1ValidateHouseholdNoPii(household)) {
    return { error: 'PII not allowed', programs: [], no_pii_sent: false };
  }
  const size = household.household_size || 1;
  const band = household.income_band || 'low';
  const eligible = E1_NYC_PROGRAMS.filter(function(_, i) {
    if (band === 'low') return i < 28;
    if (band === 'moderate') return i < 18;
    return i < 8;
  });
  if (size >= 3) eligible.push('Section 8', 'WIC', 'Child Care');
  return {
    draft: true,
    label: E1_BENEFITS_DRAFT_LABEL,
    household_size: size,
    income_band: band,
    eligible_count: eligible.length,
    programs: eligible.slice(0, 12),
    all_programs_count: E1_NYC_PROGRAMS.length,
    no_pii_sent: true,
  };
}
