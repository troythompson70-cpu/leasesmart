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

function normalizeDiscovery(raw) {
  const company = String(raw.company || raw.vendor || '').trim();
  const subject = String(raw.thread_subject || raw.subject || raw.opportunity || '').trim();
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
    thread_id: raw.thread_id || raw.message_id || raw.conversation_id || '',
    message_id: raw.message_id || '',
    transmission_direction: raw.transmission_direction || 'INCOMING',
    latest_transmission_at: raw.latest_transmission_at || raw.discovered_at || isoNow(),
    message_preview: raw.message_preview || raw.preview || subject,
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

  const normalized = normalizeDiscovery(rawDiscovery || {});
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
  const existing = findExistingOpportunity(opportunities, normalized);

  if (existing.match) {
    const id = existing.match.id || existing.match.opportunity_id;
    const patch = {
      last_activity_at: isoNow(),
      latest_transmission_at: normalized.latest_transmission_at,
      transmission_direction: normalized.transmission_direction,
      message_preview: normalized.message_preview,
      source_ref: normalized.source_ref || existing.match.source_ref,
      source_evidence: normalized.source_ref || existing.match.source_evidence,
      last_verified_at: isoNow(),
      sync_state: 'Verified',
      sync_error: null,
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
    }
    const saved = saveAndVerify(feed, id, patch, opts);
    if (saved.status !== 'SAVED_VERIFIED') {
      return failWrite(saved.feed || feed, normalized, saved, 'UPDATE_EXISTING');
    }
    const audit = runPostEntryAudit(saved.feed, saved.written);
    if (!audit.ok) {
      return {
        ok: false,
        accounted_for: false,
        status: 'BLOCKED',
        integrity: 'SYNC_ERROR',
        orphan_class: 'ORPHAN_DISCOVERY',
        error: audit.failures.join('; '),
        feed: markFeedIntegrityFailure(saved.feed, audit),
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
      feed: saved.feed,
      opportunity: saved.written,
      duplicate: true,
      duplicates_prevented: 1,
      match_reason: existing.reason,
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
    conversation_id: normalized.conversation_id || null,
    next_action: normalized.next_action,
    follow_up_date: normalized.follow_up_date,
    blocker: normalized.blocker,
    revenue_potential: normalized.revenue_potential,
    transmission_direction: normalized.transmission_direction,
    latest_transmission_at: normalized.latest_transmission_at,
    message_preview: normalized.message_preview,
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
  const nextFeed = {
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

  const audit = runPostEntryAudit(verified.feed, verified.written);
  if (!audit.ok) {
    return {
      ok: false,
      accounted_for: false,
      status: 'BLOCKED',
      integrity: 'SYNC_ERROR',
      orphan_class: 'ORPHAN_DISCOVERY',
      error: audit.failures.join('; '),
      feed: markFeedIntegrityFailure(verified.feed, audit),
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
      ...verified.feed,
      integrity_verification_ok: verified.feed.integrity_verification_ok !== false,
    },
    opportunity: verified.written,
    duplicate: false,
    duplicates_prevented: 0,
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
