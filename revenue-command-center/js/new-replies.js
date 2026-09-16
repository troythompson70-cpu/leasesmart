/**
 * NEW REPLIES acknowledgement gate (AIWO-008).
 * Keyed by immutable source_message_id — never by opportunity alone.
 * Opening/reading a card does NOT clear UNACKNOWLEDGED state.
 * Only acknowledge + disposition removes from NEW REPLIES count.
 */

const STORAGE_KEY = 'tgt_rcc_new_replies_v1';
const DISPOSITIONS = Object.freeze(['RED', 'YELLOW', 'GREEN', 'PASS']);

const EXCLUDED_JOB_PATTERNS = [
  /\bindeed\b/i,
  /\bjob offer\b/i,
  /\b9[- ]?to[- ]?5\b/i,
  /\bcareer opportunity\b/i,
  /\bapply now\b/i,
];

const IGNORED_SUBJECTS = [/liaacc/i, /100 black men/i];

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
    /* ignore */
  }
}

export function isExcludedInbound(msg) {
  const subject = String(msg?.subject || msg?.thread_subject || '');
  const body = String(msg?.body_preview || msg?.message_preview || msg?.preview || '');
  const from = String(
    msg?.from_email || msg?.sender_email || msg?.sender || msg?.sender_source || '',
  ).toLowerCase();
  const received = String(msg?.received_at || msg?.latest_transmission_at || '');
  if (/indeed\.com$/i.test(from) || /@indeed\./i.test(from)) return true;
  if (EXCLUDED_JOB_PATTERNS.some((re) => re.test(subject) || re.test(body))) return true;
  // Permanently ignore Sep 16 LIAACC / 100 Black Men
  if (
    received.startsWith('2026-09-16') &&
    IGNORED_SUBJECTS.some((re) => re.test(subject) || re.test(body))
  ) {
    return true;
  }
  if (IGNORED_SUBJECTS.some((re) => re.test(subject))) return true;
  return false;
}

export function sourceMessageIdOf(msg) {
  return String(
    msg?.source_message_id ||
      msg?.message_id ||
      msg?.graph_message_id ||
      msg?.outlook_item_id ||
      msg?.id ||
      '',
  ).trim();
}

export function ensureNewRepliesArray(feed) {
  if (!feed || typeof feed !== 'object') return { new_replies: [] };
  if (!Array.isArray(feed.new_replies)) feed.new_replies = [];
  return feed;
}

function persistReply(item) {
  const id = sourceMessageIdOf(item);
  if (!id) return;
  const store = loadStore();
  store[id] = {
    source_message_id: id,
    ack_status: item.ack_status,
    disposition: item.disposition || null,
    acknowledged_by: item.acknowledged_by || null,
    acknowledged_at: item.acknowledged_at || null,
    opportunity_id: item.opportunity_id || null,
    company: item.company || null,
    updated_at: isoNow(),
  };
  saveStore(store);
}

/**
 * Upsert one NEW REPLIES item from an inbound message + linked opportunity.
 * Idempotent on source_message_id — never increments count for duplicates.
 */
export function upsertNewReply(feed, msg, opportunity, meta = {}) {
  ensureNewRepliesArray(feed);
  if (isExcludedInbound(msg)) {
    return { ok: true, skipped: true, reason: 'excluded', feed, item: null };
  }
  const sourceId = sourceMessageIdOf(msg);
  if (!sourceId) {
    return { ok: false, error: 'missing source_message_id', feed, item: null };
  }

  const store = loadStore();
  const saved = store[sourceId];
  const existingIdx = feed.new_replies.findIndex(
    (r) => sourceMessageIdOf(r) === sourceId,
  );
  const existing = existingIdx >= 0 ? feed.new_replies[existingIdx] : null;

  // If already acknowledged in durable store, keep acknowledged — do not resurrect.
  if (
    saved?.ack_status === 'ACKNOWLEDGED' ||
    existing?.ack_status === 'ACKNOWLEDGED'
  ) {
    const kept = {
      ...(existing || {}),
      ...saved,
      source_message_id: sourceId,
      ack_status: 'ACKNOWLEDGED',
    };
    if (existingIdx >= 0) feed.new_replies[existingIdx] = kept;
    return { ok: true, created: false, duplicate: true, feed, item: kept };
  }

  const receivedAt =
    msg.received_at ||
    msg.latest_transmission_at ||
    msg.receivedDateTime ||
    isoNow();
  const item = {
    new_reply_id: existing?.new_reply_id || `nr-${sourceId.slice(-24)}`,
    source_system: msg.source_system || meta.source_system || 'OUTLOOK',
    source_message_id: sourceId,
    thread_id:
      msg.thread_id ||
      msg.conversation_id ||
      msg.conversationId ||
      opportunity?.thread_id ||
      '',
    opportunity_id:
      opportunity?.opportunity_id || opportunity?.id || existing?.opportunity_id || null,
    company:
      opportunity?.company ||
      opportunity?.vendor ||
      msg.company ||
      existing?.company ||
      '',
    received_at: receivedAt,
    body_preview:
      msg.body_preview ||
      msg.message_preview ||
      msg.preview ||
      msg.bodyPreview ||
      existing?.body_preview ||
      '',
    subject: msg.subject || msg.thread_subject || opportunity?.subject || '',
    sender:
      msg.sender ||
      msg.from_name ||
      msg.from?.emailAddress?.name ||
      msg.sender_source ||
      '',
    sender_email:
      msg.sender_email ||
      msg.from_email ||
      msg.from?.emailAddress?.address ||
      '',
    recipient:
      msg.recipient ||
      msg.to_email ||
      (Array.isArray(msg.toRecipients)
        ? msg.toRecipients[0]?.emailAddress?.address
        : '') ||
      'tgates@tgttechnologies.com',
    direction: 'INCOMING',
    lane: meta.lane || opportunity?.lane || opportunity?.owner_action_category || 'Revenue',
    web_link: msg.web_link || msg.webLink || msg.open_source_url || existing?.web_link || '',
    ack_status: 'UNACKNOWLEDGED',
    disposition: null,
    acknowledged_by: null,
    acknowledged_at: null,
    next_action: existing?.next_action || opportunity?.next_action || 'Review and disposition',
    created_at: existing?.created_at || isoNow(),
    updated_at: isoNow(),
    highlighted: true,
  };

  if (existingIdx >= 0) {
    feed.new_replies[existingIdx] = { ...existing, ...item, created_at: existing.created_at };
  } else {
    feed.new_replies.push(item);
  }
  persistReply(item);
  return {
    ok: true,
    created: existingIdx < 0,
    duplicate: existingIdx >= 0,
    feed,
    item: feed.new_replies[existingIdx >= 0 ? existingIdx : feed.new_replies.length - 1],
  };
}

export function isUnacknowledgedReply(item) {
  if (!item) return false;
  return String(item.ack_status || '').toUpperCase() === 'UNACKNOWLEDGED';
}

export function countNewReplies(feed) {
  ensureNewRepliesArray(feed);
  return (feed.new_replies || []).filter(isUnacknowledgedReply).length;
}

export function listUnacknowledgedReplies(feed) {
  ensureNewRepliesArray(feed);
  return (feed.new_replies || [])
    .filter(isUnacknowledgedReply)
    .slice()
    .sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)));
}

/**
 * Acknowledge requires disposition. Opening/reading must NOT call this.
 */
export function acknowledgeNewReply(feed, sourceMessageId, disposition, by = 'Troy') {
  ensureNewRepliesArray(feed);
  const d = String(disposition || '').toUpperCase();
  if (!DISPOSITIONS.includes(d)) {
    return {
      ok: false,
      error: 'Acknowledgement requires disposition: RED | YELLOW | GREEN | PASS',
      feed,
    };
  }
  const id = String(sourceMessageId || '').trim();
  const idx = feed.new_replies.findIndex((r) => sourceMessageIdOf(r) === id);
  if (idx < 0) return { ok: false, error: 'new reply not found', feed };

  const prev = feed.new_replies[idx];
  const next = {
    ...prev,
    ack_status: 'ACKNOWLEDGED',
    disposition: d,
    acknowledged_by: by,
    acknowledged_at: isoNow(),
    highlighted: false,
    updated_at: isoNow(),
  };
  feed.new_replies[idx] = next;
  persistReply(next);

  // Patch linked opportunity canonical fields when present.
  const opps = Array.isArray(feed.opportunities) ? feed.opportunities : [];
  const oi = opps.findIndex(
    (o) => String(o.opportunity_id || o.id) === String(next.opportunity_id),
  );
  if (oi >= 0) {
    const opp = opps[oi];
    const history = Array.isArray(opp.history) ? [...opp.history] : [];
    history.push({
      type: 'NEW_REPLY_ACKNOWLEDGED',
      source_message_id: id,
      disposition: d,
      by,
      at: next.acknowledged_at,
    });
    opps[oi] = {
      ...opp,
      last_inbound_at: next.received_at,
      latest_transmission_at: next.received_at,
      transmission_direction: 'INCOMING',
      message_preview: next.body_preview,
      message_id: id,
      open_source_url: next.web_link || opp.open_source_url,
      disposition: d,
      acknowledged_by: by,
      acknowledged_at: next.acknowledged_at,
      next_action:
        d === 'PASS'
          ? opp.next_action || 'Archived reply'
          : d === 'GREEN'
            ? opp.next_action || 'Continue'
            : d === 'YELLOW'
              ? 'Waiting / Review'
              : 'Action Required',
      history,
    };
    feed.opportunities = opps;
  }

  return { ok: true, feed, item: next };
}

/**
 * Integrity recovery: newer inbound than last ack with no NEW REPLIES item → recreate.
 */
export function recoverMissingNewReplies(feed, inboundMessages = []) {
  ensureNewRepliesArray(feed);
  const errors = [];
  let recreated = 0;
  for (const msg of inboundMessages) {
    if (isExcludedInbound(msg)) continue;
    const sourceId = sourceMessageIdOf(msg);
    if (!sourceId) continue;
    const exists = feed.new_replies.some((r) => sourceMessageIdOf(r) === sourceId);
    if (exists) continue;

    const oppId = msg.opportunity_id;
    const opp = (feed.opportunities || []).find(
      (o) => String(o.opportunity_id || o.id) === String(oppId),
    );
    const lastAck = opp?.acknowledged_at || opp?.last_acknowledged_message_at;
    const received = msg.received_at || msg.latest_transmission_at;
    if (lastAck && received && Date.parse(received) <= Date.parse(lastAck)) continue;

    const result = upsertNewReply(feed, msg, opp, { source_system: 'INTEGRITY_RECOVERY' });
    if (result.ok && result.created) {
      recreated += 1;
      errors.push({
        code: 'ERR-DATA-002',
        source_message_id: sourceId,
        message: 'Recreated missing NEW REPLIES item from newer inbound',
      });
    }
  }
  if (errors.length) {
    feed.integrity_errors = [...(feed.integrity_errors || []), ...errors];
  }
  return { feed, recreated, errors };
}

export function mergePersistedNewReplies(feed) {
  ensureNewRepliesArray(feed);
  const store = loadStore();
  if (!Object.keys(store).length) return feed;
  feed.new_replies = feed.new_replies.map((item) => {
    const id = sourceMessageIdOf(item);
    const saved = store[id];
    if (!saved) return item;
    // Durable ack wins — refresh must not resurrect UNACKNOWLEDGED after ack.
    if (saved.ack_status === 'ACKNOWLEDGED') {
      return {
        ...item,
        ack_status: 'ACKNOWLEDGED',
        disposition: saved.disposition || item.disposition,
        acknowledged_by: saved.acknowledged_by || item.acknowledged_by,
        acknowledged_at: saved.acknowledged_at || item.acknowledged_at,
        highlighted: false,
      };
    }
    return {
      ...item,
      ack_status: saved.ack_status || item.ack_status,
    };
  });
  // Also restore store-only unacknowledged items missing from feed.
  for (const [id, saved] of Object.entries(store)) {
    if (saved.ack_status !== 'UNACKNOWLEDGED') continue;
    if (feed.new_replies.some((r) => sourceMessageIdOf(r) === id)) continue;
    feed.new_replies.push({
      new_reply_id: `nr-${id.slice(-24)}`,
      source_message_id: id,
      ...saved,
      highlighted: true,
      body_preview: saved.body_preview || '',
      received_at: saved.received_at || saved.updated_at,
    });
  }
  return feed;
}

export function clearNewRepliesStore() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export { STORAGE_KEY, DISPOSITIONS };
