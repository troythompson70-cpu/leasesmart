/**
 * NEWARK DATA-A1 — Landlord / housing inventory layer (pure helpers).
 * Mirror in index.html for browser runtime.
 */

export const DATA_A1_BANNED_LABELS = [
  /\bverified\b/i, /\bguaranteed\b/i, /\bapproved\b/i, /\bsafe\b/i, /\bperfect match\b/i
];

export const DATA_A1_EXTERNAL_DISCLAIMER = 'External public source — confirm before referral.';

export function dataA1GetListingById(seed, listingId) {
  var list = (seed && seed.listings) || [];
  return list.find(function(l) { return l.listing_id === listingId; }) || null;
}

export function dataA1MergeListingState(listing, override) {
  if (!override) return Object.assign({}, listing);
  return Object.assign({}, listing, override);
}

export function dataA1CountByProviderType(listings) {
  var counts = {};
  (listings || []).forEach(function(l) {
    counts[l.source_type] = (counts[l.source_type] || 0) + 1;
  });
  return counts;
}

export function dataA1ValidateNoBannedCopy(text) {
  return !DATA_A1_BANNED_LABELS.some(function(re) { return re.test(text || ''); });
}

export function dataA1MapsSearchUrl(listing) {
  var q = [listing.location_label, listing.city, listing.state, listing.zip].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

export function dataA1MapsSatelliteUrl(listing) {
  return dataA1MapsSearchUrl(listing) + '&basemap=satellite';
}
