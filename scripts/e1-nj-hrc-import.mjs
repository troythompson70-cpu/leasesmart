/**
 * Sprint E1 — NJ Housing Resource Center public data import skeleton
 */
export const E1_NJ_HRC_SOURCE = 'nj.gov/njhrc';
export const E1_NJ_HRC_LABEL = 'Public Source — NJ Registry';
export const E1_NJ_TARGET_COUNTIES = ['Essex', 'Passaic', 'Hudson', 'Bergen', 'Union'];

export function e1MapNjHrcToLandlordIntel(row, idx) {
  const n = idx || 0;
  const county = row.county || E1_NJ_TARGET_COUNTIES[n % E1_NJ_TARGET_COUNTIES.length];
  return {
    id: 'e1-njhrc-' + (row.record_id || ('nj-' + n)),
    is_public: true,
    owner_key: 'e1-public-seed',
    landlord_name: row.provider_name || ('NJ HRC Provider ' + (n + 1)),
    property_name: row.project_name || (county + ' Affordable Listing'),
    address: row.address || (200 + n) + ' Public Listing Way',
    city: row.city || 'Sample City',
    state: 'NJ',
    zip: row.zip || '07000',
    county: county,
    source_type: 'housing_program',
    source_label: E1_NJ_HRC_LABEL,
    source_url: 'https://www.nj.gov/dca/hmfa/',
    verification_status: 'Public Source Only',
    availability_status: row.availability || 'Waitlist',
    program_notes: 'NJ HRC public listing — not a verified vacancy claim.',
    program_compatibility: 'Section 8',
    warning_flags: ['public_source_only', 'not_verified_claim'],
  };
}
