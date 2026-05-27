/**
 * Sprint E1 — NYC Open Data HPD landlord registration (official API skeleton)
 */
export const E1_NYC_OPEN_DATA_HOST = 'data.cityofnewyork.us';
export const E1_HPD_RESOURCE_ID = 'tesw-yqq4';
export const E1_HPD_API_URL = 'https://' + E1_NYC_OPEN_DATA_HOST + '/resource/' + E1_HPD_RESOURCE_ID + '.json';
export const E1_HPD_SOURCE_LABEL = 'Public Source — HPD Registry';

export function e1MapHpdToLandlordIntel(row, idx) {
  const n = idx || 0;
  const boro = row.boro || row.borough || 'Manhattan';
  return {
    id: 'e1-hpd-' + (row.registrationid || row.registration_id || ('demo-' + n)),
    is_public: true,
    owner_key: 'e1-public-seed',
    landlord_name: row.businessname || row.business_name || ('HPD Registrant ' + (n + 1)),
    property_name: (row.plantype || 'Residential') + ' — ' + boro,
    address: (row.housenumber || row.house_number || (100 + n)) + ' ' + (row.streetname || row.street_name || 'Registry St'),
    city: boro,
    state: 'NY',
    zip: row.zip || '10001',
    county: boro,
    phone: '',
    email: '',
    website: '',
    source_type: 'public_record',
    source_label: E1_HPD_SOURCE_LABEL,
    source_url: 'https://' + E1_NYC_OPEN_DATA_HOST + '/City-Government/HPD-Registration-Contact-Information/' + E1_HPD_RESOURCE_ID,
    verification_status: 'Public Source Only',
    availability_status: 'Unknown',
    program_notes: 'NYC HPD public registry mapping — not a verified vacancy claim.',
    program_compatibility: 'Section 8',
    warning_flags: ['public_source_only', 'not_verified_claim'],
    neighborhood_notes: 'Official NYC Open Data API only — no scraping.',
    next_recheck_date: '2026-08-01',
  };
}

export function e1ValidateRecordNoPii(record) {
  if (!record) return false;
  const blob = JSON.stringify(record).toLowerCase();
  const forbidden = ['ssn', 'social_security', 'tenant_name', 'resident_name'];
  return !forbidden.some(function(f) { return blob.includes('"' + f + '"'); });
}
