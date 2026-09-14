/**
 * Opportunity card helpers + reply timing.
 */
import { STALE_MS, REPLY_DELAY_MINUTES_DEFAULT } from './constants.js';
import { findDuplicateCollisions } from './dedupe.js';

function parseTime(v) {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

export function cardSyncState(opp, now = Date.now()) {
  if (opp.sync_error || opp.sync_state === 'Error') return 'Error';
  const t = parseTime(opp.last_verified_at);
  if (!t || now - t > STALE_MS) return 'Stale';
  return 'Verified';
}

export function cardBadges(opp, allOpps, now = Date.now()) {
  const badges = [];
  const sync = cardSyncState(opp, now);
  if (sync === 'Stale') badges.push({ type: 'STALE', label: 'STALE' });
  if (sync === 'Error') badges.push({ type: 'ERROR', label: 'SYNC ERROR' });

  if (!(opp.source || opp.source_evidence || opp.source_ref)) {
    badges.push({ type: 'SOURCE_REQUIRED', label: 'SOURCE REQUIRED' });
  }

  const collisions = findDuplicateCollisions(allOpps || []);
  const id = String(opp.id || opp.opportunity_id);
  const hit = collisions.some((c) =>
    c.records.some((r) => String(r.id || r.opportunity_id) === id),
  );
  if (hit || opp.duplicate_flag) {
    badges.push({ type: 'DUPLICATE', label: 'DUPLICATE REVIEW' });
  }
  return badges;
}

/**
 * Ordinary inbound external reply timing indicator.
 * Default ~20 minutes after receipt unless urgent/outage/override.
 */
export function replyTimingMessage(opp, now = Date.now()) {
  if (!opp || !opp.inbound_reply_received_at) return null;
  if (opp.urgent_deadline || opp.outage_security_event || opp.troy_override_timing) {
    return opp.troy_override_timing || 'Reply timing overridden — handle per Troy/outage rules';
  }
  const received = parseTime(opp.inbound_reply_received_at);
  if (!received) return null;
  const availableAt = received + REPLY_DELAY_MINUTES_DEFAULT * 60 * 1000;
  const mins = Math.max(0, Math.ceil((availableAt - now) / 60000));
  if (mins <= 0) return 'Reply available now';
  return `Reply available in approximately ${mins} minutes`;
}

export function ownerActionYesNo(opp) {
  const s = String(opp.status || '').toUpperCase();
  if (opp.owner_action_required === true || opp.owner_action_required === 'Yes') return 'Yes';
  if (opp.owner_action_required === false || opp.owner_action_required === 'No') return 'No';
  return s === 'OWNER_ACTION' || s === 'ACCOUNT_SETUP' || s === 'BLOCKED' ? 'Yes' : 'No';
}
