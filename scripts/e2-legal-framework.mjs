/**
 * Sprint E2 — legal framework helpers (regression module)
 */
export const E2_COOKIE_KEY = 'leasesmart_cookie_consent_v1';

export function e2CanTrack(choice) {
  return choice === 'accepted';
}

export function e2ValidateConsentRecord(record) {
  return !!(record && record.clientId && record.consentText && record.attorneyApprovalRequired === true);
}
