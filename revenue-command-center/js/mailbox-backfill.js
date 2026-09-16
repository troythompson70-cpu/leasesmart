/**
 * Historical mailbox backfill — idempotent message → opportunity reconciliation.
 * Nothing disappears silently. Second run must not create duplicates.
 */
import { processDiscovery } from './discovery-pipeline.js';
import { findExistingOpportunity } from './dedupe.js';

function isoNow() {
  return new Date().toISOString();
}

function defaultFollowUp() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

function messageKey(msg) {
  return String(
    msg.message_id ||
      msg.graph_message_id ||
      msg.outlook_item_id ||
      msg.id ||
      '',
  ).trim();
}

function conversationKey(msg) {
  return String(
    msg.conversation_id ||
      msg.thread_id ||
      msg.outlook_conversation_id ||
      '',
  ).trim();
}

/**
 * Normalize an Outlook / shared-mailbox message into a discovery candidate.
 */
export function messageToCandidate(msg) {
  const subject = String(msg.subject || msg.thread_subject || '').trim();
  const fromEmail =
    msg.from_email ||
    msg.sender_email ||
    msg.from?.emailAddress?.address ||
    msg.sender_source ||
    '';
  const company = String(
    msg.company ||
      msg.from_domain_company ||
      msg.sender_company ||
      '',
  ).trim();
  return {
    company,
    vendor: company,
    opportunity: subject || `Mailbox message ${messageKey(msg) || 'unknown'}`,
    subject,
    thread_subject: subject,
    source: msg.source || msg.mailbox || 'OUTLOOK_BACKFILL',
    source_ref:
      msg.source_ref ||
      `mailbox:${messageKey(msg) || conversationKey(msg) || subject}`,
    thread_id: conversationKey(msg) || messageKey(msg),
    message_id: messageKey(msg),
    source_message_id: messageKey(msg),
    conversation_id: conversationKey(msg) || msg.conversationId || null,
    from_email: fromEmail,
    sender_email: fromEmail,
    sender_source: fromEmail || msg.from?.emailAddress?.name || '',
    contact_name: msg.from_name || msg.from?.emailAddress?.name || msg.sender || '',
    recipient:
      msg.recipient ||
      msg.to_email ||
      (Array.isArray(msg.toRecipients)
        ? msg.toRecipients[0]?.emailAddress?.address
        : '') ||
      '',
    transmission_direction: msg.direction === 'OUTBOUND' ? 'OUTBOUND' : 'INCOMING',
    latest_transmission_at:
      msg.received_at || msg.receivedDateTime || msg.sent_at || msg.at || isoNow(),
    received_at: msg.received_at || msg.receivedDateTime || msg.at,
    message_preview: msg.body_preview || msg.bodyPreview || msg.preview || subject,
    body_preview: msg.body_preview || msg.bodyPreview || msg.preview || subject,
    tier: msg.tier != null ? String(msg.tier) : '2',
    status: 'NEW',
    owner: 'Troy',
    next_action: 'Classify mailbox candidate',
    follow_up_date: defaultFollowUp(),
    open_source_url: msg.web_link || msg.webLink || msg.open_source_url || null,
    web_link: msg.web_link || msg.webLink || msg.open_source_url || null,
  };
}

/**
 * Run historical backfill for a window of messages.
 * Each message matches/updates an opportunity OR creates a NEW ACTIVITY candidate.
 */
export function runMailboxBackfill(feed, messages = [], opts = {}) {
  const started = isoNow();
  let working = feed
    ? { ...feed, opportunities: [...(feed.opportunities || [])] }
    : null;

  if (!working) {
    return {
      ok: false,
      error: 'No Command Center feed',
      imported: 0,
      matched: 0,
      created: 0,
      duplicates_prevented: 0,
      feed: null,
      at: started,
    };
  }

  const seenMessages = new Set(
    (working.imported_message_ids || []).map((id) => String(id)),
  );
  let imported = 0;
  let matched = 0;
  let created = 0;
  let duplicatesPrevented = 0;
  const failures = [];

  for (const msg of messages || []) {
    const mid = messageKey(msg);
    if (mid && seenMessages.has(mid) && opts.allowReprocess !== true) {
      // Idempotent skip — already imported
      duplicatesPrevented += 1;
      continue;
    }

    const candidate = messageToCandidate(msg);
    const existing = findExistingOpportunity(
      working.opportunities || [],
      candidate,
      working,
    );
    const result = processDiscovery(working, candidate);

    if (!result.ok) {
      if (result.feed) working = result.feed;
      failures.push({
        message_id: mid,
        error: result.error || 'Backfill write failed',
      });
      continue;
    }

    working = result.feed;
    imported += 1;
    if (result.duplicate || existing.match) {
      matched += 1;
      duplicatesPrevented += result.duplicates_prevented || 1;
    } else {
      created += 1;
    }
    if (mid) seenMessages.add(mid);
  }

  const coverageVerified =
    opts.markCoverageVerified === true && failures.length === 0;

  working = {
    ...working,
    imported_message_ids: [...seenMessages],
    mailbox_backfill: {
      at: isoNow(),
      window_start: opts.windowStart || null,
      window_end: opts.windowEnd || null,
      imported,
      matched,
      created,
      duplicates_prevented: duplicatesPrevented,
      failures,
      run_count: ((working.mailbox_backfill || {}).run_count || 0) + 1,
    },
    mailbox_coverage_verified:
      coverageVerified || working.mailbox_coverage_verified === true,
    mailbox_coverage_warning:
      coverageVerified || working.mailbox_coverage_verified === true
        ? null
        : 'Full mailbox coverage is not verified.',
    feed_updated_at: isoNow(),
  };

  return {
    ok: failures.length === 0,
    imported,
    matched,
    created,
    duplicates_prevented: duplicatesPrevented,
    failures,
    feed: working,
    mailbox_coverage_verified: working.mailbox_coverage_verified === true,
    at: started,
  };
}

/**
 * Idempotency helper — run the same message set twice; second pass should not create.
 */
export function assertBackfillIdempotent(feed, messages) {
  const first = runMailboxBackfill(feed, messages);
  const countAfterFirst = (first.feed?.opportunities || []).length;
  const second = runMailboxBackfill(first.feed, messages);
  const countAfterSecond = (second.feed?.opportunities || []).length;
  return {
    ok:
      first.ok &&
      second.ok &&
      countAfterFirst === countAfterSecond &&
      second.created === 0,
    first,
    second,
    countAfterFirst,
    countAfterSecond,
  };
}
