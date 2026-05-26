/**
 * Sprint D2 — saved search alert matching (dummy logic only)
 */
export const D2_ALERT_TYPE = 'saved_search_match';

export function d2MatchLandlords(records, filters) {
  filters = filters || {};
  return (records || []).filter(function(r) {
    if (filters.county && r.county !== filters.county) return false;
    if (filters.verification && r.verification_status !== filters.verification) return false;
    if (filters.availability && r.availability_status !== filters.availability) return false;
    if (filters.program && r.program_compatibility !== filters.program) return false;
    return true;
  });
}

export function d2FindNewMatches(profile, records, mockAlerts) {
  profile = profile || {};
  mockAlerts = mockAlerts || [];
  var seen = profile.seenIds || [];
  var fromMock = mockAlerts
    .filter(function(a) { return a.profileId === profile.id && seen.indexOf(a.landlordId) < 0; })
    .map(function(a) { return { landlordId: a.landlordId, title: a.title, message: a.message, isMock: true }; });
  if (fromMock.length) return fromMock;
  var matches = d2MatchLandlords(records, profile.filters || {});
  return matches
    .filter(function(r) { return seen.indexOf(r.id) < 0; })
    .slice(0, 2)
    .map(function(r) {
      return {
        landlordId: r.id,
        title: 'New landlord match',
        message: 'Demo: ' + (r.property_name || r.landlord_name) + ' matches saved search (MOCK)',
        isMock: true
      };
    });
}
