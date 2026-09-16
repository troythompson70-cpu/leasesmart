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
 * Detect a placeholder / demo email link so the UI can label it clearly.
 * Demo signals: the literal token "Demo" in the href (our fixtures embed it),
 * or an Outlook subject-search link (outlook.office.com/mail/?q=…) which is a
 * best-effort search stub rather than a real thread deep link.
 * Real deep links from a live feed return false.
 * @param {string|null|undefined} href
 * @returns {boolean}
 */
export function isDemoEmailLink(href) {
  if (!href) return false;
  const s = String(href);
  if (/Demo/i.test(s)) return true;
  if (/outlook\.office\.com\/mail\/\?q=/i.test(s)) return true;
  return false;
}

/**
 * Build a usable Outlook / email deep link from feed fields.
 * Prefers explicit open_source_url; otherwise constructs Outlook deep links.
 * The returned object carries `isDemo` so callers can visibly mark demo links.
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
    return { href: String(explicit), kind: 'explicit', isDemo: isDemoEmailLink(explicit) };
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
    const href = `https://outlook.office.com/mail/deeplink/read/${encoded}`;
    return { href, kind: 'outlook_item', isDemo: isDemoEmailLink(href) };
  }
  if (conversationId) {
    const encoded = encodeURIComponent(String(conversationId));
    const href = `https://outlook.office.com/mail/deeplink/read/${encoded}`;
    return { href, kind: 'outlook_conversation', isDemo: isDemoEmailLink(href) };
  }

  // Search fallback by subject — still a real navigable link (not a toast stub),
  // but a subject search, not a true thread deep link → mark as demo.
  const subject = opp.thread_subject || opp.subject || opp.most_recent_email;
  if (subject) {
    const q = encodeURIComponent(String(subject));
    const href = `https://outlook.office.com/mail/?q=${q}`;
    return { href, kind: 'outlook_search', isDemo: true };
  }

  const threadId = opp.thread_id;
  if (threadId && String(threadId).startsWith('AAMk')) {
    const encoded = encodeURIComponent(String(threadId));
    const href = `https://outlook.office.com/mail/deeplink/read/${encoded}`;
    return { href, kind: 'outlook_thread_id', isDemo: isDemoEmailLink(href) };
  }

  return null;
}
