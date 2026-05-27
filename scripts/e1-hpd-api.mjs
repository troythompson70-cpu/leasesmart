/**
 * Sprint E1 — NYC Open Data HPD landlord registration (official API skeleton)
 */
export const E1_NYC_OPEN_DATA_HOST = 'data.cityofnewyork.us';
export const E1_HPD_REGISTRATIONS_ID = 'tesw-yqqr';
export const E1_HPD_CONTACTS_ID = 'feu5-w2e2';
export const E1_HPD_RESOURCE_ID = E1_HPD_REGISTRATIONS_ID;
export const E1_HPD_API_URL = 'https://' + E1_NYC_OPEN_DATA_HOST + '/resource/' + E1_HPD_REGISTRATIONS_ID + '.json';
export const E1_HPD_CONTACTS_URL = 'https://' + E1_NYC_OPEN_DATA_HOST + '/resource/' + E1_HPD_CONTACTS_ID + '.json';
export const E1_HPD_SOURCE_LABEL = 'Public Source — HPD Registry';

export function e1MapHpdToLandlordIntel(row, idx, contactByRegId) {
  const n = idx || 0;
  const boro = titleCase(row.boro || row.borough || 'Manhattan');
  const regId = row.registrationid || row.registration_id || ('demo-' + n);
  const contact = contactByRegId && contactByRegId[regId];
  const house = row.housenumber || row.house_number || row.lowhousenumber || '';
  const street = row.streetname || row.street_name || 'Registry St';
  return {
    id: 'e1-hpd-' + regId + '-' + (row.buildingid || n),
    external_source_id: 'hpd:' + regId + ':' + (row.buildingid || n),
    is_public: true,
    owner_key: 'e1-public-seed',
    landlord_name: (contact && contact.corporationname) || ('HPD Registrant ' + regId),
    property_name: 'HPD Registered Building — ' + boro,
    address: (house ? house + ' ' : '') + street,
    city: boro,
    state: 'NY',
    zip: (row.zip || '10001').slice(0, 5),
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

function titleCase(s) {
  return String(s || '').toLowerCase().replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

export async function e1FetchHpdRegistrations(limit, offset) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 5000);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const url = E1_HPD_API_URL + '?$limit=' + lim + '&$offset=' + off + '&$order=lastregistrationdate DESC';
  const res = await fetch(url);
  if (!res.ok) throw new Error('HPD API HTTP ' + res.status);
  return res.json();
}

export async function e1FetchHpdContactsForRegistrations(registrationIds) {
  const ids = [...new Set((registrationIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const chunk = ids.slice(0, 50);
  const where = "registrationid in ('" + chunk.join("','") + "') AND type='CorporateOwner'";
  const url = E1_HPD_CONTACTS_URL + '?$select=registrationid,corporationname,type&$where=' + encodeURIComponent(where);
  const res = await fetch(url);
  if (!res.ok) return {};
  const rows = await res.json();
  const map = {};
  rows.forEach(function(r) {
    if (r.registrationid && r.corporationname && !map[r.registrationid]) {
      map[r.registrationid] = r;
    }
  });
  return map;
}

export function e1ValidateRecordNoPii(record) {
  if (!record) return false;
  const blob = JSON.stringify(record).toLowerCase();
  const forbidden = ['ssn', 'social_security', 'tenant_name', 'resident_name'];
  return !forbidden.some(function(f) { return blob.includes('"' + f + '"'); });
}
