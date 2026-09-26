/**
 * Dashboard sorting + owner-action panel selection.
 * Lead list default: Newest First. Closed (PASS/LOST/WON) stay at the bottom.
 */
import { CLOSED_STATUSES, OWNER_ACTION_PRIORITY } from './constants.js';

function isClosed(status) {
  return CLOSED_STATUSES.includes(String(status || '').toUpperCase());
}

export function activityTimestamp(opp) {
  const candidates = [
    opp?.latest_transmission_at,
    opp?.last_activity_at,
    opp?.new_activity_at,
    opp?.updated_at,
    opp?.last_updated,
    opp?.last_verified_at,
    opp?.created_at,
    opp?.source_date,
  ];
  let best = 0;
  for (const raw of candidates) {
    const t = Date.parse(String(raw || ''));
    if (Number.isFinite(t) && t > best) best = t;
  }
  return best;
}

/**
 * Sort opportunities: open items Newest First, then PASS/LOST/WON.
 */
export function sortOpportunitiesBy(opportunities, mode) {
  const list = Array.isArray(opportunities) ? [...opportunities] : [];
  const nameOf = (opp) => String(opp?.company || opp?.vendor || '');
  if (mode === 'company') {
    return list.sort((a, b) => nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: 'base' }));
  }
  if (mode === 'status') {
    return list.sort((a, b) => {
      const byStatus = String(a?.status || '').localeCompare(String(b?.status || ''), undefined, { sensitivity: 'base' });
      return byStatus || nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: 'base' });
    });
  }
  if (mode === 'tier') {
    return list.sort((a, b) => {
      const aTier = Number(a?.tier);
      const bTier = Number(b?.tier);
      const aRank = Number.isFinite(aTier) ? aTier : 99;
      const bRank = Number.isFinite(bTier) ? bTier : 99;
      return aRank - bRank || nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: 'base' });
    });
  }
  return sortOpportunities(list);
}

export function sortOpportunities(opportunities) {
  const list = Array.isArray(opportunities) ? [...opportunities] : [];
  return list.sort((a, b) => {
    const aClosed = isClosed(a.status);
    const bClosed = isClosed(b.status);
    if (aClosed !== bClosed) return aClosed ? 1 : -1;
    const delta = activityTimestamp(b) - activityTimestamp(a);
    if (delta !== 0) return delta;
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
