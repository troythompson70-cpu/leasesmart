/**
 * Dashboard sorting + owner-action panel selection.
 */
import { CLOSED_STATUSES, OWNER_ACTION_PRIORITY } from './constants.js';

function isClosed(status) {
  return CLOSED_STATUSES.includes(String(status || '').toUpperCase());
}

function statusRank(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'OWNER_ACTION' || s === 'BLOCKED') return 0;
  if (['QUALIFYING', 'REPLIED', 'PROPOSAL', 'ACCOUNT_SETUP', 'APPROVED'].includes(s))
    return 1;
  if (['CONTACTED', 'WAITING', 'CONTACT_READY', 'NEW', 'EXPANSION'].includes(s)) return 2;
  return 3;
}

/**
 * Sort opportunities:
 * Tier 1 OWNER_ACTION/BLOCKED/deadlines → Tier 1 active → Tier 2 → Tier 3 → PASS/LOST
 */
export function sortOpportunities(opportunities) {
  const list = Array.isArray(opportunities) ? [...opportunities] : [];
  return list.sort((a, b) => {
    const aClosed = isClosed(a.status);
    const bClosed = isClosed(b.status);
    if (aClosed !== bClosed) return aClosed ? 1 : -1;

    const aTier = Number(a.tier) || 99;
    const bTier = Number(b.tier) || 99;
    if (aTier !== bTier) return aTier - bTier;

    if (aTier === 1) {
      const ar = statusRank(a.status);
      const br = statusRank(b.status);
      if (ar !== br) return ar - br;
      const aDl = a.hard_deadline || a.deadline || '';
      const bDl = b.hard_deadline || b.deadline || '';
      if (aDl && bDl && aDl !== bDl) return aDl < bDl ? -1 : 1;
      if (aDl && !bDl) return -1;
      if (!aDl && bDl) return 1;
    }
    return String(a.company || a.vendor || '').localeCompare(
      String(b.company || b.vendor || ''),
    );
  });
}

function ownerPriority(opp) {
  const key = String(opp.owner_action_category || opp.blocker_type || 'other').toLowerCase();
  if (OWNER_ACTION_PRIORITY[key] != null) return OWNER_ACTION_PRIORITY[key];
  if (opp.revenue_blocker) return OWNER_ACTION_PRIORITY.revenue_blocker;
  if (opp.hard_deadline || opp.deadline) return OWNER_ACTION_PRIORITY.hard_deadline;
  if (opp.onboarding_blocker) return OWNER_ACTION_PRIORITY.onboarding_blocker;
  if (String(opp.status).toUpperCase() === 'ACCOUNT_SETUP')
    return OWNER_ACTION_PRIORITY.account_activation;
  if (opp.insurance_coi || /coi|insurance/i.test(String(opp.next_action || '')))
    return OWNER_ACTION_PRIORITY.insurance_coi;
  if (/reply|form/i.test(String(opp.next_action || '')))
    return OWNER_ACTION_PRIORITY.required_reply_form;
  return OWNER_ACTION_PRIORITY.other;
}

/**
 * Tier 1 OWNER_ACTION / ACCOUNT_SETUP / BLOCKED until explicitly closed.
 */
export function selectOwnerActionPanel(opportunities) {
  const open = (opportunities || []).filter((o) => {
    if (Number(o.tier) !== 1) return false;
    if (isClosed(o.status)) return false;
    const s = String(o.status || '').toUpperCase();
    return s === 'OWNER_ACTION' || s === 'ACCOUNT_SETUP' || s === 'BLOCKED';
  });
  return open.sort((a, b) => {
    const p = ownerPriority(a) - ownerPriority(b);
    if (p !== 0) return p;
    const aDl = a.hard_deadline || a.deadline || '9999';
    const bDl = b.hard_deadline || b.deadline || '9999';
    return aDl < bDl ? -1 : aDl > bDl ? 1 : 0;
  });
}
