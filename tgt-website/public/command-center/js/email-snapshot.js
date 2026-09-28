/**
 * Recent Email + Conversation Snapshot + empty-body repair.
 * Never expose Graph/SharePoint credential/config wording in card UI.
 */

const SAFE_UNAVAILABLE = 'Email details temporarily unavailable — retrying';
const FORBIDDEN_UI_PATTERNS = [
  /sharepoint blocked/i,
  /graph credentials/i,
  /deployed secrets/i,
  /client[_-]?secret/i,
  /api[_-]?key/i,
  /not configured in app/i,
];

export function sanitizeUiText(text) {
  const s = String(text || '');
  if (!s) return '';
  if (FORBIDDEN_UI_PATTERNS.some((re) => re.test(s))) return SAFE_UNAVAILABLE;
  return s;
}

export function recentEmailOf(opp) {
  if (!opp) return null;
  const body =
    opp.message_body ||
    opp.body ||
    opp.message_preview ||
    opp.latest_message_preview ||
    opp.preview ||
    '';
  const subject =
    opp.latest_subject || opp.subject || opp.thread_subject || opp.most_recent_email || '';
  const at =
    opp.latest_transmission_at ||
    opp.last_inbound_at ||
    opp.last_outbound_at ||
    opp.last_message_at ||
    null;
  const direction = String(
    opp.transmission_direction || opp.latest_transmission_direction || '',
  )
    .trim()
    .toUpperCase();
  const sender =
    opp.latest_sender || opp.sender_source || opp.sender || opp.from_email || '';
  const recipient = opp.recipient || opp.to_email || opp.to || '';
  const messageId =
    opp.source_message_id || opp.message_id || opp.graph_message_id || opp.latest_event_id || '';
  const webLink = opp.open_source_url || opp.web_link || opp.webLink || '';

  if (!at && !subject && !body && !messageId) return null;

  const cleanBody = sanitizeUiText(body);
  const needsRepair = !!(messageId && !String(cleanBody || '').trim());

  return {
    subject: sanitizeUiText(subject),
    body: cleanBody,
    preview: cleanBody ? String(cleanBody).slice(0, 280) : '',
    at,
    direction:
      direction === 'OUTBOUND' || direction === 'OUT'
        ? 'OUTBOUND'
        : direction === 'INCOMING' || direction === 'INBOUND' || direction === 'IN'
          ? 'INCOMING'
          : direction || '—',
    sender: sanitizeUiText(sender),
    recipient: sanitizeUiText(recipient),
    messageId,
    webLink,
    needsRepair,
    unavailable: needsRepair ? SAFE_UNAVAILABLE : null,
  };
}

export function conversationSnapshotOf(opp) {
  const recent = recentEmailOf(opp);
  if (!recent) return null;
  const history = Array.isArray(opp.conversation_history)
    ? opp.conversation_history
    : Array.isArray(opp.thread_messages)
      ? opp.thread_messages
      : [];
  const items = history.length
    ? history.slice(-5).map((m) => ({
        at: m.at || m.received_at || m.sent_at || null,
        direction: m.direction || m.transmission_direction || '—',
        sender: sanitizeUiText(m.sender || m.from || ''),
        recipient: sanitizeUiText(m.recipient || m.to || ''),
        subject: sanitizeUiText(m.subject || ''),
        preview: sanitizeUiText(m.body_preview || m.preview || m.body || '').slice(0, 200),
      }))
    : [
        {
          at: recent.at,
          direction: recent.direction,
          sender: recent.sender,
          recipient: recent.recipient,
          subject: recent.subject,
          preview: recent.preview,
        },
      ];
  return {
    thread: recent.subject,
    items,
    emptyError: !!(recent.messageId && !recent.preview && !recent.body),
  };
}

/**
 * Repair empty body when source_message_id exists.
 * Uses provided message payload (Outlook/Graph read-through result) — never secrets in UI.
 */
export function repairEmailFields(opp, messagePayload) {
  if (!opp) return { ok: false, error: 'missing opportunity', opp };
  const messageId =
    opp.source_message_id || opp.message_id || opp.graph_message_id || '';
  const current = recentEmailOf(opp);
  if (current && current.preview && !current.needsRepair) {
    return { ok: true, repaired: false, opp, reason: 'already_populated' };
  }
  if (!messageId && !messagePayload) {
    return {
      ok: false,
      error: 'no source_message_id for repair',
      opp: {
        ...opp,
        message_preview: sanitizeUiText(opp.message_preview) || SAFE_UNAVAILABLE,
        ui_email_status: SAFE_UNAVAILABLE,
      },
    };
  }
  if (!messagePayload) {
    return {
      ok: false,
      pending: true,
      error: 'awaiting_read_through',
      opp: {
        ...opp,
        message_preview: SAFE_UNAVAILABLE,
        ui_email_status: SAFE_UNAVAILABLE,
        // Strip any leaked config diagnostics from persisted fields.
        sync_error: sanitizeUiText(opp.sync_error) === SAFE_UNAVAILABLE ? null : opp.sync_error,
      },
    };
  }

  const body =
    messagePayload.body_preview ||
    messagePayload.bodyPreview ||
    messagePayload.preview ||
    messagePayload.body ||
    '';
  const next = {
    ...opp,
    message_preview: sanitizeUiText(body),
    message_body: sanitizeUiText(body),
    subject:
      sanitizeUiText(messagePayload.subject || opp.subject) || opp.subject,
    sender_source:
      sanitizeUiText(
        messagePayload.sender ||
          messagePayload.from_email ||
          messagePayload.from?.emailAddress?.address ||
          opp.sender_source,
      ) || opp.sender_source,
    recipient:
      sanitizeUiText(
        messagePayload.recipient ||
          messagePayload.to_email ||
          (Array.isArray(messagePayload.toRecipients)
            ? messagePayload.toRecipients[0]?.emailAddress?.address
            : '') ||
          opp.recipient,
      ) || opp.recipient,
    latest_transmission_at:
      messagePayload.received_at ||
      messagePayload.receivedDateTime ||
      opp.latest_transmission_at,
    transmission_direction:
      messagePayload.direction || opp.transmission_direction || 'INCOMING',
    open_source_url:
      messagePayload.web_link ||
      messagePayload.webLink ||
      opp.open_source_url ||
      opp.web_link,
    web_link:
      messagePayload.web_link ||
      messagePayload.webLink ||
      opp.web_link ||
      opp.open_source_url,
    source_message_id: messageId || sourceId(messagePayload),
    message_id: messageId || sourceId(messagePayload),
    ui_email_status: null,
    sync_error:
      sanitizeUiText(opp.sync_error) === SAFE_UNAVAILABLE ? null : opp.sync_error,
    email_repaired_at: new Date().toISOString(),
  };
  return { ok: true, repaired: true, opp: next };
}

function sourceId(msg) {
  return String(msg?.id || msg?.message_id || msg?.source_message_id || '').trim();
}

export function assertNoSecretLeak(text) {
  const s = String(text || '');
  return !FORBIDDEN_UI_PATTERNS.some((re) => re.test(s));
}

export { SAFE_UNAVAILABLE, FORBIDDEN_UI_PATTERNS };
