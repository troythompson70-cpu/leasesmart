/**
 * Sprint E1 — NJ Housing Resource Center public data import
 * NJHRC has no public listing API — uses HUD multifamily public data for NJ target counties.
 */
export const E1_NJ_HRC_SOURCE = 'nj.gov/njhrc';
export const E1_NJ_HRC_LABEL = 'Public Source — NJ Registry';
export const E1_NJ_HRC_URL = 'https://www.nj.gov/njhrc/';
export const E1_NJ_TARGET_COUNTIES = ['Essex', 'Passaic', 'Hudson', 'Bergen', 'Union'];
export const E1_HUD_NJ_MULTIFAMILY_URL =
  'https://services.arcgis.com/VTyQ9soqVukalItT/ArcGIS/rest/services/HUD_Insured_Multifamily_Properties/FeatureServer/0/query';

export const E1_NJ_ZIP_PREFIX_BY_COUNTY = {
  Essex: ['070', '071'],
  Passaic: ['074', '075'],
  Hudson: ['073', '070'],
  Bergen: ['076'],
  Union: ['070', '072', '079'],
};

export function e1NjCountyFromZip(zip) {
  const z = String(zip || '').replace(/\D/g, '').slice(0, 3);
  if (!z) return null;
  for (const county of E1_NJ_TARGET_COUNTIES) {
    const prefixes = E1_NJ_ZIP_PREFIX_BY_COUNTY[county] || [];
    if (prefixes.some(function(p) { return z.startsWith(p); })) return county;
  }
  return null;
}

export function e1MapNjHrcToLandlordIntel(row, idx) {
  const n = idx || 0;
  const county = row.county || E1_NJ_TARGET_COUNTIES[n % E1_NJ_TARGET_COUNTIES.length];
  return {
    id: 'e1-njhrc-' + (row.record_id || ('nj-' + n)),
    external_source_id: row.external_source_id || ('njhrc:' + (row.record_id || n)),
    is_public: true,
    owner_key: 'e1-public-seed',
    landlord_name: row.provider_name || row.landlord_name || ('NJ HRC Provider ' + (n + 1)),
    property_name: row.project_name || row.property_name || (county + ' Affordable Listing'),
    address: row.address || (200 + n) + ' Public Listing Way',
    city: row.city || 'Sample City',
    state: 'NJ',
    zip: row.zip || '07000',
    county: county,
    source_type: 'housing_program',
    source_label: E1_NJ_HRC_LABEL,
    source_url: E1_NJ_HRC_URL,
    verification_status: 'Public Source Only',
    availability_status: row.availability || 'Unknown',
    program_notes: row.program_notes || 'NJ public housing registry mapping — not a verified vacancy claim.',
    program_compatibility: 'Section 8',
    warning_flags: ['public_source_only', 'not_verified_claim'],
  };
}

export function e1MapHudNjToLandlordIntel(attrs, idx) {
  const zip = String(attrs.STD_ZIP5 || '').trim();
  const county = e1NjCountyFromZip(zip);
  if (!county) return null;
  const propId = attrs.PROPERTY_ID || attrs.OBJECTID || idx;
  const landlord = (attrs.MGMT_AGENT_ORG_NAME || attrs.PROPERTY_NAME_TEXT || 'NJ Housing Provider').trim();
  return e1MapNjHrcToLandlordIntel({
    record_id: 'hud-nj-' + propId,
    external_source_id: 'hud-nj:' + propId,
    provider_name: landlord,
    property_name: (attrs.PROPERTY_NAME_TEXT || '').trim() || (county + ' Multifamily'),
    address: (attrs.STD_ADDR || '').trim(),
    city: (attrs.STD_CITY || '').trim(),
    zip: zip,
    county: county,
    program_notes: 'HUD multifamily public data (NJ target county). NJHRC has no public API — not a verified vacancy claim.',
  }, idx);
}

export async function e1FetchHudNjMultifamily(limit) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 2000);
  const url = E1_HUD_NJ_MULTIFAMILY_URL +
    '?where=' + encodeURIComponent("STD_ST='NJ'") +
    '&outFields=PROPERTY_ID,PROPERTY_NAME_TEXT,STD_ADDR,STD_CITY,STD_ZIP5,MGMT_AGENT_ORG_NAME' +
    '&returnGeometry=false&resultRecordCount=' + lim + '&f=json';
  const res = await fetch(url);
  if (!res.ok) throw new Error('HUD NJ multifamily HTTP ' + res.status);
  const json = await res.json();
  if (json.error) throw new Error('HUD NJ multifamily: ' + (json.error.message || 'query failed'));
  const records = [];
  (json.features || []).forEach(function(f, i) {
    const mapped = e1MapHudNjToLandlordIntel(f.attributes || {}, i);
    if (mapped) records.push(mapped);
  });
  return records;
}
