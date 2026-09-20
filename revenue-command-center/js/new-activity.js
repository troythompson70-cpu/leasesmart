/**
 * Persistent NEW ACTIVITY / UNREAD acknowledgement.
 * ACKNOWLEDGED ≠ classification (VALID/INVALID/UNSURE).
 * Survives browser refresh via localStorage + feed fields.
 */
import { hasIncomingAttention } from './transmission.js';
import { activityTimestamp } from './sorting.js';

const STORAGE_KEY = 'tgt_rcc_new_activity_v1';

function isoNow() {
  return new Date().toISOString();
}

function loadStore() {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveStore(store) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

export function activityKey(opp) {
  return String(opp?.opportunity_id || opp?.record_id || opp?.id || opp?.lead_id || '').trim();
}

export function markNewActivity(opp, meta = {}) {
  const at = isoNow();
  return {
    acknowledgement_state: 'UNREAD',
    incoming_attention: true,
    new_activity: true,
    new_activity_at: at,
    new_activity_reason: meta.reason || 'new_activity',
    // Classification stays separate — never auto-set VALID/DONE on new activity.
    classification: opp?.classification || 'UNSURE',
  };
}

export function isUnreadActivity(opp) {
  if (!opp) return false;
  const ack = String(opp.acknowledgement_state || '').toUpperCase();
  if (ack === 'ACKNOWLEDGED' || ack === 'READ') return false;
  if (ack === 'UNREAD') return true;
  if (opp.new_activity === true || opp.incoming_attention === true) return true;
  return false;
}

/**
 * Acknowledge only — does NOT change status, classification, or close the item.
 */
export function acknowledgeActivity(opp) {
  if (!opp) return { ok: false, error: 'missing opportunity' };
  const next = {
    ...opp,
    acknowledgement_state: 'ACKNOWLEDGED',
    acknowledged_at: isoNow(),
    incoming_attention: false,
    new_activity: false,
    // Preserve business fields
    status: opp.status,
    classification: opp.classification || 'UNSURE',
    notes: opp.notes,
    transmission_direction: opp.transmission_direction,
    latest_transmission_at: opp.latest_transmission_at,
    message_preview: opp.message_preview,
  };
  persistAck(next);
  return {
    ok: true,
    opp: next,
    statusUnchanged: next.status === opp.status,
    classificationUnchanged: next.classification === (opp.classification || 'UNSURE'),
  };
}

/**
 * Classify separately from acknowledgement.
 */
export function classifyActivity(opp, classification) {
  const allowed = new Set(['VALID', 'INVALID', 'UNSURE']);
  const c = String(classification || '').toUpperCase();
  if (!allowed.has(c)) {
    return { ok: false, error: `Invalid classification: ${classification}` };
  }
  const next = {
    ...opp,
    classification: c,
    classified_at: isoNow(),
    status: opp.status, // never auto-close on classify
  };
  persistAck(next);
  return { ok: true, opp: next, statusUnchanged: true };
}

function persistAck(opp) {
  const key = activityKey(opp);
  if (!key) return;
  const store = loadStore();
  store[key] = {
    acknowledgement_state: opp.acknowledgement_state,
    acknowledged_at: opp.acknowledged_at || null,
    classification: opp.classification || 'UNSURE',
    classified_at: opp.classified_at || null,
    incoming_attention: opp.incoming_attention === true,
    new_activity: opp.new_activity === true,
    updated_at: isoNow(),
  };
  saveStore(store);
}

/**
 * Merge durable ack state from localStorage into feed opportunities (refresh survival).
 */
export function mergePersistedActivity(feed) {
  if (!feed || typeof feed !== 'object') return feed;
  const listKey = Array.isArray(feed.opportunities)
    ? 'opportunities'
    : Array.isArray(feed.records)
      ? 'records'
      : null;
  if (!listKey) return feed;
  const store = loadStore();
  if (!Object.keys(store).length) return feed;
  const opportunities = feed[listKey].map((opp) => {
    const key = activityKey(opp);
    const saved = store[key];
    if (!saved) return opp;
    return {
      ...opp,
      acknowledgement_state: saved.acknowledgement_state || opp.acknowledgement_state,
      acknowledged_at: saved.acknowledged_at || opp.acknowledged_at,
      classification: saved.classification || opp.classification,
      classified_at: saved.classified_at || opp.classified_at,
      incoming_attention:
        saved.acknowledgement_state === 'ACKNOWLEDGED'
          ? false
          : saved.incoming_attention ?? opp.incoming_attention,
      new_activity:
        saved.acknowledgement_state === 'ACKNOWLEDGED'
          ? false
          : saved.new_activity ?? opp.new_activity,
    };
  });
  return { ...feed, [listKey]: opportunities };
}

export function countUnreadActivity(opportunities) {
  return (opportunities || []).filter(isUnreadActivity).length;
}

/** Stable Incoming order: existing items keep position; newcomers prepend Newest First. */
let incomingOrder = [];

export function resetIncomingBuffer() {
  incomingOrder = [];
}

export function stabilizeIncomingList(opportunities) {
  const current = (opportunities || []).filter((o) => hasIncomingAttention(o));
  const byId = new Map();
  for (const opp of current) {
    const key = activityKey(opp);
    if (key) byId.set(key, opp);
  }
  incomingOrder = incomingOrder.filter((id) => byId.has(id));
  const known = new Set(incomingOrder);
  const newcomers = current
    .filter((o) => {
      const key = activityKey(o);
      return key && !known.has(key);
    })
    .sort((a, b) => activityTimestamp(b) - activityTimestamp(a));
  incomingOrder = [...newcomers.map((o) => activityKey(o)), ...incomingOrder];
  return incomingOrder.map((id) => byId.get(id)).filter(Boolean);
}

export function clearActivityStore() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export { STORAGE_KEY };
