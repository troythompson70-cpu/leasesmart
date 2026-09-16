/**
 * TGT Revenue Command Center — shared constants (schema 2.2 contract).
 * Source of truth remains SharePoint TEAM TGT MSP dashboard feed.
 * Canonical path: Shared Documents/General/TGT REVENUE COMMAND CENTER
 */
export const SCHEMA_VERSION = '2.2';

export const STATUSES = Object.freeze([
  'NEW',
  'CONTACT_READY',
  'CONTACTED',
  'WAITING',
  'REPLIED',
  'QUALIFYING',
  'PROPOSAL',
  'ACCOUNT_SETUP',
  'APPROVED',
  'OWNER_ACTION',
  'WON',
  'EXPANSION',
  'LOST',
  'PASS',
  'BLOCKED',
]);

export const CLOSED_STATUSES = Object.freeze(['WON', 'LOST', 'PASS', 'DONE']);

export const HEALTH = Object.freeze({
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  RED: 'RED',
});

export const HEALTH_LABELS = Object.freeze({
  GREEN: 'SYSTEM SYNCED',
  YELLOW: 'REVIEW REQUIRED',
  RED: 'SYSTEM OUT OF SYNC — REVIEW AUDIT BEFORE ACTING',
});

export const STALE_MS = 24 * 60 * 60 * 1000;
export const REPLY_DELAY_MINUTES_DEFAULT = 20;

export const ACTION_LOCK_MESSAGE =
  'Actions temporarily limited until synchronization errors are reconciled.';

/** Owner-action panel sort priority (lower = higher). */
export const OWNER_ACTION_PRIORITY = Object.freeze({
  revenue_blocker: 1,
  hard_deadline: 2,
  onboarding_blocker: 3,
  account_activation: 4,
  insurance_coi: 5,
  required_reply_form: 6,
  other: 7,
});

/**
 * Verified account evidence that overrides stale LIST SOFTWARE setup tasks.
 * Evidence timestamps are from Outlook (not invented statuses).
 */
export const SOFTWARE_EVIDENCE_OVERRIDES = Object.freeze([
  {
    vendorKeys: ['cisco', 'duo', 'cisco / duo', 'cisco secure msp'],
    evidenceLabel: 'Cisco Secure MSP Center welcome + SAML enabled (Outlook 2026-09-14)',
    evidenceAt: '2026-09-14T17:41:19Z',
    suppressActions: ['activate', 'create account', 'nfr/msp', 'join', 'setup'],
  },
  {
    vendorKeys: ['huntress'],
    evidenceLabel: 'Huntress weekly summary for TGT TECHNOLOGIES INC. (Outlook 2026-09-14)',
    evidenceAt: '2026-09-14T10:06:41Z',
    suppressActions: ['complete partner setup', 'create account', 'initial setup', 'setup'],
  },
  {
    vendorKeys: ['cursor'],
    evidenceLabel: 'Cursor already active for TGT automation',
    evidenceAt: '2026-09-14T00:00:00Z',
    suppressActions: ['new account', 'create account', 'setup', 'activate'],
  },
]);
