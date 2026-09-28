/**
 * Atomic discovery → canonical Command Center write.
 * Law: IF AI KNOWS ABOUT IT, COMMAND CENTER MUST KNOW ABOUT IT.
 * Discovery is not complete until SAVED + VERIFIED → ACCOUNTED_FOR.
 */
import { findExistingOpportunity } from './dedupe.js';
import { saveAndVerify, applyOpportunityPatch } from './save-verify.js';
import { leadIdOf } from './transmission.js';
import { runPostEntryAudit } from './post-entry-audit.js';
import { markNewActivity } from './new-activity.js';
import { upsertNewReply, ensureNewRepliesArray } from './new-replies.js';
import {
  extractEmailDomain,
  resolveCompanyFromDomain,
  upsertCompanyRecord,
} from './company-domain.js';
import { repairEmailFields, sanitizeUiText } from './email-snapshot.js';
import { SCHEMA_VERSION } from './constants.js';

function isoNow() {
  return new Date().toISOString();
}

function slug(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}

export function allocateOpportunityId(candidate, existing = []) {
  const explicit = String(candidate.opportunity_id || candidate.record_id || candidate.id || '').trim();
  if (explicit) return explicit;
  const company = slug(candidate.company || candidate.vendor || 'UNK');
  const stamp = Date.now().toString(36).toUpperCase();
  let id = `TGT-${company}-${stamp}`;
  const used = new Set((existing || []).map((o) => String(o.opportunity_id || o.id || o.record_id)));
  let n = 0;
  while (used.has(id)) {
    n += 1;
    id = `TGT-${company}-${stamp}-${n}`;
  }
  return id;
}

function defaultFollowUpDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

function normalizeDiscovery(raw, feed = null) {
  const email =
    raw.from_email ||
    raw.sender_email ||
    raw.sender_source ||
    raw.email ||
    raw.from?.emailAddress?.address ||
    '';
  const domain = extractEmailDomain(raw.email_domain || email);
  const resolved = domain ? resolveCompanyFromDomain(domain, feed) : null;
  const company = String(
    raw.company || raw.vendor || resolved?.company || '',
  ).trim();
  const subject = String(raw.thread_subject || raw.subject || raw.opportunity || '').trim();
  const preview = sanitizeUiText(
    raw.message_preview || raw.body_preview || raw.preview || raw.bodyPreview || subject,
  );
  return {
    ...raw,
    company,
    vendor: raw.vendor || company,
    subject,
    thread_subject: raw.thread_subject || subject,
    opportunity: raw.opportunity || subject,
    source: raw.source || raw.source_system || 'AI_DISCOVERY',
    source_ref: raw.source_ref || raw.source_evidence || raw.evidence || '',
    tier: raw.tier != null && raw.tier !== '' ? String(raw.tier) : '2',
    status: raw.status || 'NEW',
    owner: raw.owner || 'Troy',
    next_action: raw.next_action || 'Qualify and set follow-up',
    follow_up_date: raw.follow_up_date || raw.followup_date || defaultFollowUpDate(),
    thread_id: raw.thread_id || raw.conversation_id || raw.message_id || '',
    conversation_id: raw.conversation_id || raw.conversationId || '',
    message_id: raw.message_id || raw.id || raw.source_message_id || '',
    source_message_id: raw.source_message_id || raw.message_id || raw.id || '',
    email_domain: domain || '',
    from_email: email,
    sender_email: email,
    sender_source: raw.sender_source || raw.sender || email,
    recipient:
      raw.recipient ||
      raw.to_email ||
      (Array.isArray(raw.toRecipients)
        ? raw.toRecipients[0]?.emailAddress?.address
        : '') ||
      '',
    transmission_direction: raw.transmission_direction || 'INCOMING',
    latest_transmission_at:
      raw.latest_transmission_at || raw.received_at || raw.receivedDateTime || raw.discovered_at || isoNow(),
    message_preview: preview,
    open_source_url: raw.open_source_url || raw.web_link || raw.webLink || '',
    web_link: raw.web_link || raw.webLink || raw.open_source_url || '',
    contact_name:
      raw.contact_name ||
      raw.from_name ||
      raw.from?.emailAddress?.name ||
      raw.sender ||
      '',
    domains: domain ? [domain] : [],
    revenue_potential: raw.revenue_potential || raw.value || null,
    blocker: raw.blocker || '',
  };
}

/**
 * Process one discovery atomically into the feed working copy.
 * @returns {{ ok, accounted_for, status, feed, opportunity, duplicate, audit, error, integrity }}
 */
export function processDiscovery(feed, rawDiscovery, opts = {}) {
  if (!feed || typeof feed !== 'object') {
    return {
      ok: false,
      accounted_for: false,
      status: 'BLOCKED',
      integrity: 'SYNC_ERROR',
      orphan_class: 'ORPHAN_DISCOVERY',
      error: 'No Command Center feed available for durable write',
      feed,
    };
  }

  ensureNewRepliesArray(feed);
  const normalized = normalizeDiscovery(rawDiscovery || {}, feed);
  if (!normalized.company || !normalized.subject) {
    return {
      ok: false,
      accounted_for: false,
      status: 'BLOCKED',
      integrity: 'SYNC_ERROR',
      orphan_class: 'ORPHAN_DISCOVERY',
      error: 'Discovery missing company or opportunity/subject — cannot create canonical record',
      feed,
    };
  }

  const opportunities = Array.isArray(feed.opportunities) ? feed.opportunities : [];
  const existing = findExistingOpportunity(opportunities, normalized, feed);

  if (existing.match) {
    const id = existing.match.id || existing.match.opportunity_id;
    let repairedOpp = existing.match;
    if (
      (normalized.message_id || normalized.source_message_id) &&
      !String(existing.match.message_preview || '').trim()
    ) {
      const repaired = repairEmailFields(existing.match, normalized);
      if (repaired.ok) repairedOpp = repaired.opp;
    }
    const patch = {
      last_activity_at: isoNow(),
      latest_transmission_at: normalized.latest_transmission_at,
      transmission_direction: normalized.transmission_direction,
      message_preview: sanitizeUiText(
        normalized.message_preview || repairedOpp.message_preview || '',
      ),
      message_body: sanitizeUiText(normalized.message_preview || repairedOpp.message_body || ''),
      subject: normalized.subject || repairedOpp.subject,
      sender_source: normalized.sender_source || repairedOpp.sender_source,
      recipient: normalized.recipient || repairedOpp.recipient,
      message_id: normalized.message_id || repairedOpp.message_id,
      source_message_id: normalized.source_message_id || repairedOpp.source_message_id,
      conversation_id: normalized.conversation_id || repairedOpp.conversation_id,
      open_source_url: normalized.open_source_url || repairedOpp.open_source_url,
      web_link: normalized.web_link || repairedOpp.web_link,
      domains: [
        ...new Set([...(repairedOpp.domains || []), ...(normalized.domains || [])]),
      ],
      email_domain: normalized.email_domain || repairedOpp.email_domain,
      source_ref: normalized.source_ref || existing.match.source_ref,
      source_evidence: normalized.source_ref || existing.match.source_evidence,
      last_verified_at: isoNow(),
      sync_state: 'Verified',
      sync_error: null,
      ui_email_status: null,
      accounted_for: true,
      record_id: existing.match.record_id || leadIdOf(existing.match),
      follow_up_date:
        existing.match.follow_up_date ||
        existing.match.followup_date ||
        normalized.follow_up_date,
      owner: existing.match.owner || normalized.owner,
      next_action: existing.match.next_action || normalized.next_action,
    };
    if (normalized.transmission_direction === 'INCOMING') {
      Object.assign(patch, markNewActivity(existing.match, { reason: 'reply_or_rediscovery' }));
      patch.last_inbound_at = normalized.latest_transmission_at;
    }
    const saved = saveAndVerify(feed, id, patch, opts);
    if (saved.status !== 'SAVED_VERIFIED') {
      return failWrite(saved.feed || feed, normalized, saved, 'UPDATE_EXISTING');
    }
    let nextFeed = saved.feed;
    const companyUpsert = upsertCompanyRecord(nextFeed, {
      company: normalized.company,
      domain: normalized.email_domain,
      email: normalized.from_email,
      contact_name: normalized.contact_name,
      opportunity_id: id,
      direction: normalized.transmission_direction,
      at: normalized.latest_transmission_at,
      website: normalized.email_domain ? `https://${normalized.email_domain}` : null,
      conversation_entry: {
        at: normalized.latest_transmission_at,
        direction: normalized.transmission_direction,
        subject: normalized.subject,
        preview: normalized.message_preview,
        source_message_id: normalized.source_message_id,
      },
    });
    if (companyUpsert.ok) nextFeed = companyUpsert.feed;

    let newReply = null;
    if (normalized.transmission_direction === 'INCOMING') {
      const nr = upsertNewReply(nextFeed, normalized, saved.written, {
        source_system: normalized.source || 'OUTLOOK',
      });
      nextFeed = nr.feed;
      newReply = nr.item;
    }

    const audit = runPostEntryAudit(nextFeed, saved.written);
    if (!audit.ok) {
      return {
        ok: false,
        accounted_for: false,
        status: 'BLOCKED',
        integrity: 'SYNC_ERROR',
        orphan_class: 'ORPHAN_DISCOVERY',
        error: audit.failures.join('; '),
        feed: markFeedIntegrityFailure(nextFeed, audit),
        opportunity: saved.written,
        duplicate: true,
        match_reason: existing.reason,
        audit,
      };
    }
    return {
      ok: true,
      accounted_for: true,
      status: 'ACCOUNTED_FOR',
      feed: nextFeed,
      opportunity: (nextFeed.opportunities || []).find(
        (o) => String(o.opportunity_id || o.id) === String(id),
      ) || saved.written,
      duplicate: true,
      duplicates_prevented: 1,
      match_reason: existing.reason,
      new_reply: newReply,
      company: companyUpsert.company || null,
      audit,
      message: 'SAVED + VERIFIED (updated existing)',
    };
  }

  const opportunityId = allocateOpportunityId(normalized, opportunities);
  const recordId = normalized.record_id || opportunityId;
  const created = {
    id: opportunityId,
    opportunity_id: opportunityId,
    record_id: recordId,
    lead_id: opportunityId,
    company: normalized.company,
    vendor: normalized.vendor,
    opportunity: normalized.opportunity,
    subject: normalized.subject,
    thread_subject: normalized.thread_subject,
    tier: normalized.tier,
    status: normalized.status,
    owner: normalized.owner,
    owner_action_required: normalized.owner_action_required || false,
    source: normalized.source,
    source_ref: normalized.source_ref,
    source_evidence: normalized.source_ref,
    thread_id: normalized.thread_id,
    message_id: normalized.message_id,
    source_message_id: normalized.source_message_id,
    conversation_id: normalized.conversation_id || null,
    open_source_url: normalized.open_source_url || null,
    web_link: normalized.web_link || null,
    email_domain: normalized.email_domain || null,
    domains: normalized.domains || [],
    sender_source: normalized.sender_source || '',
    recipient: normalized.recipient || '',
    contact_name: normalized.contact_name || '',
    next_action: normalized.next_action,
    follow_up_date: normalized.follow_up_date,
    blocker: normalized.blocker,
    revenue_potential: normalized.revenue_potential,
    transmission_direction: normalized.transmission_direction,
    latest_transmission_at: normalized.latest_transmission_at,
    last_inbound_at:
      normalized.transmission_direction === 'INCOMING'
        ? normalized.latest_transmission_at
        : null,
    message_preview: normalized.message_preview,
    message_body: normalized.message_preview,
    last_activity_at: isoNow(),
    last_verified_at: isoNow(),
    discovered_at: normalized.discovered_at || isoNow(),
    schema_version: SCHEMA_VERSION,
    sync_state: 'Verified',
    accounted_for: false,
    acknowledgement_state: 'UNREAD',
    classification: 'UNSURE',
    incoming_attention: true,
    ...markNewActivity(null, { reason: 'new_discovery' }),
  };

  // Atomic create into working copy then verify read-back.
  let nextFeed = {
    ...feed,
    opportunities: [...opportunities, created],
    feed_updated_at: isoNow(),
    schema_version: feed.schema_version || SCHEMA_VERSION,
  };

  const readback = (nextFeed.opportunities || []).find(
    (o) => String(o.opportunity_id || o.id) === String(opportunityId),
  );
  if (!readback) {
    return failWrite(feed, normalized, { status: 'WRITE_FAILED', message: 'SAVE FAILED' }, 'CREATE');
  }

  // Mark accounted only after read-back proves the record exists.
  const verified = applyOpportunityPatch(nextFeed, opportunityId, {
    accounted_for: true,
    last_verified_at: isoNow(),
  });
  if (!verified.ok) {
    return failWrite(nextFeed, normalized, { status: 'WRITE_FAILED', message: 'SAVE FAILED' }, 'ACCOUNT');
  }
  nextFeed = verified.feed;

  const companyUpsert = upsertCompanyRecord(nextFeed, {
    company: normalized.company,
    domain: normalized.email_domain,
    email: normalized.from_email,
    contact_name: normalized.contact_name,
    opportunity_id: opportunityId,
    direction: normalized.transmission_direction,
    at: normalized.latest_transmission_at,
    website: normalized.email_domain ? `https://${normalized.email_domain}` : null,
    conversation_entry: {
      at: normalized.latest_transmission_at,
      direction: normalized.transmission_direction,
      subject: normalized.subject,
      preview: normalized.message_preview,
      source_message_id: normalized.source_message_id,
    },
  });
  if (companyUpsert.ok) nextFeed = companyUpsert.feed;

  let newReply = null;
  if (normalized.transmission_direction === 'INCOMING') {
    const nr = upsertNewReply(nextFeed, normalized, verified.written, {
      source_system: normalized.source || 'OUTLOOK',
    });
    nextFeed = nr.feed;
    newReply = nr.item;
  }

  const audit = runPostEntryAudit(nextFeed, verified.written);
  if (!audit.ok) {
    return {
      ok: false,
      accounted_for: false,
      status: 'BLOCKED',
      integrity: 'SYNC_ERROR',
      orphan_class: 'ORPHAN_DISCOVERY',
      error: audit.failures.join('; '),
      feed: markFeedIntegrityFailure(nextFeed, audit),
      opportunity: verified.written,
      duplicate: false,
      audit,
    };
  }

  return {
    ok: true,
    accounted_for: true,
    status: 'ACCOUNTED_FOR',
    feed: {
      ...nextFeed,
      integrity_verification_ok: nextFeed.integrity_verification_ok !== false,
    },
    opportunity: (nextFeed.opportunities || []).find(
      (o) => String(o.opportunity_id || o.id) === String(opportunityId),
    ) || verified.written,
    duplicate: false,
    duplicates_prevented: 0,
    new_reply: newReply,
    company: companyUpsert.company || null,
    audit,
    message: 'SAVED + VERIFIED',
  };
}

function failWrite(feed, discovery, saved, phase) {
  const failed = {
    phase,
    company: discovery.company,
    subject: discovery.subject,
    problem: saved.message || saved.error || 'Canonical write failed',
    status: 'BLOCKED',
    recommended_fix: 'Retry durable Command Center write before reporting discovery',
    at: isoNow(),
  };
  const next = {
    ...feed,
    failed_writes: [...(feed.failed_writes || []), failed],
    orphan_discoveries: [
      ...(feed.orphan_discoveries || []),
      {
        ...failed,
        orphan_class: 'ORPHAN_DISCOVERY',
        integrity: 'SYNC_ERROR',
      },
    ],
    integrity_verification_ok: false,
    ui_sync_health: {
      ...(feed.ui_sync_health || {}),
      health_state: 'RED',
      failed_write_count: ((feed.ui_sync_health || {}).failed_write_count || 0) + 1,
      orphan_discovery_count:
        ((feed.ui_sync_health || {}).orphan_discovery_count || 0) + 1,
    },
  };
  return {
    ok: false,
    accounted_for: false,
    status: 'BLOCKED',
    integrity: 'SYNC_ERROR',
    orphan_class: 'ORPHAN_DISCOVERY',
    error: failed.problem,
    feed: next,
    phase,
  };
}

function markFeedIntegrityFailure(feed, audit) {
  return {
    ...feed,
    integrity_verification_ok: false,
    failed_writes: [
      ...(feed.failed_writes || []),
      {
        problem: (audit.failures || []).join('; '),
        status: 'BLOCKED',
        recommended_fix: 'Repair post-entry audit failures',
        at: isoNow(),
      },
    ],
    ui_sync_health: {
      ...(feed.ui_sync_health || {}),
      health_state: 'RED',
    },
  };
}
