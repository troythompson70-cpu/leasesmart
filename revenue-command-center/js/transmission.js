/**
 * Latest transmission + Lead ID helpers (Dashboard Feed schema 2.2).
 */

export function leadIdOf(opp) {
  if (!opp) return '';
  return String(
    opp.lead_id || opp.opportunity_id || opp.id || '',
  ).trim();
}

export function transmissionOf(opp) {
  if (!opp) return null;
  const direction = String(
    opp.transmission_direction ||
      opp.latest_transmission_direction ||
      opp.direction ||
      '',
  )
    .trim()
    .toUpperCase();
  const at =
    opp.latest_transmission_at ||
    opp.latest_transmission_timestamp ||
    opp.transmission_at ||
    opp.last_message_at ||
    null;
  const subject =
    opp.latest_subject ||
    opp.subject ||
    opp.thread_subject ||
    opp.most_recent_email ||
    '';
  const sender =
    opp.latest_sender ||
    opp.sender_source ||
    opp.sender ||
    opp.source ||
    '';
  const preview =
    opp.message_preview ||
    opp.latest_message_preview ||
    opp.preview ||
    '';
  const eventId =
    opp.latest_event_id ||
    opp.event_id ||
    opp.latest_message_id ||
    '';
  if (!direction && !at && !subject && !preview) return null;
  return {
    direction: direction === 'OUTBOUND' || direction === 'OUT' ? 'OUTBOUND' : direction === 'INCOMING' || direction === 'INBOUND' || direction === 'IN' ? 'INCOMING' : direction || '—',
    at,
    subject,
    sender,
    preview,
    eventId,
  };
}

export function hasIncomingAttention(opp) {
  if (!opp) return false;
  const v = opp.incoming_attention;
  if (v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true') {
    return true;
  }
  if (v === false || v === 0 || v === '0' || String(v).toLowerCase() === 'false') {
    return false;
  }
  // Fallback: INCOMING direction with no explicit clear still counts as attention.
  const t = transmissionOf(opp);
  return !!(t && t.direction === 'INCOMING' && opp.incoming_attention !== false);
}

/**
 * Clear Incoming attention only — never mutates permanent business status
 * and never deletes correspondence / transmission fields.
 */
export function clearIncomingAttention(opp) {
  if (!opp || typeof opp !== 'object') {
    return { ok: false, opp, error: 'missing opportunity' };
  }
  const next = { ...opp, incoming_attention: false };
  // Preserve status, notes, transmission, correspondence fields explicitly.
  next.status = opp.status;
  next.notes = opp.notes;
  next.latest_transmission_at = opp.latest_transmission_at;
  next.transmission_direction = opp.transmission_direction;
  next.message_preview = opp.message_preview;
  next.latest_event_id = opp.latest_event_id;
  next.subject = opp.subject;
  next.thread_id = opp.thread_id;
  next.open_source_url = opp.open_source_url;
  return { ok: true, opp: next, statusUnchanged: next.status === opp.status };
}

/**
 * Build a usable Outlook / email deep link from feed fields.
 * Prefers explicit open_source_url; otherwise constructs Outlook deep links.
 */
export function buildEmailThreadLink(opp) {
  if (!opp) return null;
  const explicit =
    opp.open_source_url ||
    opp.email_url ||
    opp.outlook_url ||
    opp.webLink ||
    opp.web_link ||
    null;
  if (explicit && /^https?:\/\//i.test(String(explicit))) {
    return { href: String(explicit), kind: 'explicit' };
  }

  const conversationId =
    opp.conversation_id ||
    opp.outlook_conversation_id ||
    null;
  const itemId =
    opp.outlook_item_id ||
    opp.message_id ||
    opp.graph_message_id ||
    null;

  // Outlook Web deep-link patterns (read-only open).
  if (itemId) {
    const encoded = encodeURIComponent(String(itemId));
    return {
      href: `https://outlook.office.com/mail/deeplink/read/${encoded}`,
      kind: 'outlook_item',
    };
  }
  if (conversationId) {
    const encoded = encodeURIComponent(String(conversationId));
    return {
      href: `https://outlook.office.com/mail/deeplink/read/${encoded}`,
      kind: 'outlook_conversation',
    };
  }

  // Search fallback by subject — still a real navigable link (not a toast stub).
  const subject = opp.thread_subject || opp.subject || opp.most_recent_email;
  if (subject) {
    const q = encodeURIComponent(String(subject));
    return {
      href: `https://outlook.office.com/mail/?q=${q}`,
      kind: 'outlook_search',
    };
  }

  const threadId = opp.thread_id;
  if (threadId && String(threadId).startsWith('AAMk')) {
    const encoded = encodeURIComponent(String(threadId));
    return {
      href: `https://outlook.office.com/mail/deeplink/read/${encoded}`,
      kind: 'outlook_thread_id',
    };
  }

  return null;
}
