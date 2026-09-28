/**
 * Orphan discovery reconciliation.
 * Compare known discoveries/reports/mail against canonical Command Center.
 * Target: UNRESOLVED_ORPHANS = 0.
 */
import { processDiscovery } from './discovery-pipeline.js';
import { findExistingOpportunity } from './dedupe.js';
import { getOpportunities, getPipeline } from './feed-loader.js';

function isoNow() {
  return new Date().toISOString();
}

function asCandidate(raw, sourceTag) {
  if (!raw || typeof raw !== 'object') return null;
  const company = String(raw.company || raw.vendor || raw.organization || '').trim();
  const subject = String(
    raw.opportunity ||
      raw.thread_subject ||
      raw.subject ||
      raw.title ||
      raw.name ||
      '',
  ).trim();
  if (!company && !subject) return null;
  return {
    company: company || subject,
    vendor: raw.vendor || company || subject,
    opportunity: subject || company,
    subject,
    thread_subject: raw.thread_subject || subject,
    source: raw.source || sourceTag,
    source_ref: raw.source_ref || raw.source_evidence || raw.evidence || `${sourceTag}:${raw.id || raw.message_id || subject}`,
    thread_id: raw.thread_id || raw.conversation_id || '',
    message_id: raw.message_id || raw.email_id || raw.id || '',
    opportunity_id: raw.opportunity_id || raw.record_id || raw.lead_id || '',
    record_id: raw.record_id || raw.opportunity_id || '',
    tier: raw.tier != null ? String(raw.tier) : '2',
    status: raw.status || 'NEW',
    owner: raw.owner || 'Troy',
    next_action: raw.next_action || 'Qualify orphaned discovery',
    follow_up_date: raw.follow_up_date || raw.followup_date || defaultFollowUp(),
    transmission_direction: raw.transmission_direction || 'INCOMING',
    latest_transmission_at: raw.latest_transmission_at || raw.discovered_at || isoNow(),
    message_preview: raw.message_preview || raw.preview || subject,
    revenue_potential: raw.revenue_potential || raw.value || null,
    discovered_at: raw.discovered_at || isoNow(),
    _orphan_source: sourceTag,
  };
}

function defaultFollowUp() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Collect discovery-like objects from feed side channels + external bags.
 */
export function collectKnownDiscoveries(feed, external = {}) {
  const bags = [];
  const push = (arr, tag) => {
    (arr || []).forEach((item) => {
      const c = asCandidate(item, tag);
      if (c) bags.push(c);
    });
  };

  push(feed?.ai_discoveries, 'AI_DISCOVERY');
  push(feed?.chatgpt_lead_reports, 'CHATGPT_REPORT');
  push(feed?.six_pm_reports, 'SIX_PM_REPORT');
  push(feed?.report_items, 'REPORT_ITEM');
  push(feed?.outlook_messages, 'OUTLOOK');
  push(feed?.info_mailbox_messages, 'INFO_MAILBOX');
  push(feed?.list_software_discoveries, 'LIST_SOFTWARE');
  push(feed?.software_nfr_discoveries, 'SOFTWARE_NFR');
  push(feed?.msp_field_service_discoveries, 'MSP_FIELD');
  push(feed?.mwbe_procurement_discoveries, 'MWBE');
  push(feed?.website_leads, 'WEBSITE');
  push(feed?.outreach_records, 'OUTREACH');
  push(feed?.reply_records, 'REPLIES');
  push(feed?.orphan_emails, 'ORPHAN_EMAIL');
  push(feed?.orphan_discoveries, 'ORPHAN_DISCOVERY');
  push(getPipeline(feed), 'PIPELINE');

  push(external.ai_discoveries, 'AI_DISCOVERY');
  push(external.chatgpt_lead_reports, 'CHATGPT_REPORT');
  push(external.six_pm_reports, 'SIX_PM_REPORT');
  push(external.report_items, 'REPORT_ITEM');
  push(external.outlook_messages, 'OUTLOOK');
  push(external.info_mailbox_messages, 'INFO_MAILBOX');
  push(external.list_software_discoveries, 'LIST_SOFTWARE');
  push(external.software_nfr_discoveries, 'SOFTWARE_NFR');
  push(external.msp_field_service_discoveries, 'MSP_FIELD');
  push(external.mwbe_procurement_discoveries, 'MWBE');
  push(external.website_leads, 'WEBSITE');
  push(external.outreach_records, 'OUTREACH');
  push(external.reply_records, 'REPLIES');
  push(external.known_leads, 'KNOWN_LEAD');

  return bags;
}

function isMissingFromCanonical(opportunities, candidate) {
  const found = findExistingOpportunity(opportunities, candidate);
  if (found.match) return false;
  // Also match closed records by id so we don't recreate closed work as orphans.
  const id = String(candidate.opportunity_id || candidate.record_id || '').trim();
  if (id) {
    const byId = (opportunities || []).find(
      (o) =>
        String(o.opportunity_id || o.id || o.record_id || o.lead_id) === id,
    );
    if (byId) return false;
  }
  return true;
}

/**
 * Run historical orphan reconciliation against a feed working copy.
 * Safe internal repair — creates/updates canonical records via processDiscovery.
 */
export function reconcileOrphanDiscoveries(feed, external = {}) {
  const started = isoNow();
  let working = feed ? { ...feed, opportunities: [...(feed.opportunities || [])] } : null;
  if (!working) {
    return {
      ok: false,
      ORPHAN_DISCOVERIES_FOUND: 0,
      ORPHAN_DISCOVERIES_REPAIRED: 0,
      DUPLICATES_PREVENTED: 0,
      UNRESOLVED_ORPHANS: 0,
      error: 'No Command Center feed',
      feed: null,
      repaired: [],
      unresolved: [],
      at: started,
    };
  }

  const known = collectKnownDiscoveries(working, external);
  const found = [];
  const repaired = [];
  const unresolved = [];
  let duplicatesPrevented = 0;

  for (const candidate of known) {
    const opps = getOpportunities(working);
    if (!isMissingFromCanonical(opps, candidate)) {
      // Already present — still run processDiscovery to refresh evidence (dedupe path).
      const result = processDiscovery(working, candidate);
      if (result.duplicate) duplicatesPrevented += result.duplicates_prevented || 1;
      if (result.ok && result.feed) working = result.feed;
      continue;
    }

    found.push({
      company: candidate.company,
      subject: candidate.subject,
      source: candidate.source,
      source_ref: candidate.source_ref,
    });

    const result = processDiscovery(working, {
      ...candidate,
      follow_up_date: candidate.follow_up_date || defaultFollowUp(),
    });

    if (result.ok && result.feed) {
      working = result.feed;
      if (result.duplicate) {
        duplicatesPrevented += result.duplicates_prevented || 1;
      }
      repaired.push({
        opportunity_id: result.opportunity?.opportunity_id || result.opportunity?.id,
        company: candidate.company,
        subject: candidate.subject,
        source: candidate.source,
        duplicate: !!result.duplicate,
      });
    } else {
      if (result.feed) working = result.feed;
      unresolved.push({
        company: candidate.company,
        subject: candidate.subject,
        source: candidate.source,
        error: result.error || 'Repair failed',
        orphan_class: 'ORPHAN_DISCOVERY',
      });
    }
  }

  const unresolvedCount = unresolved.length;
  working = {
    ...working,
    orphan_reconciliation: {
      at: isoNow(),
      ORPHAN_DISCOVERIES_FOUND: found.length,
      ORPHAN_DISCOVERIES_REPAIRED: repaired.length,
      DUPLICATES_PREVENTED: duplicatesPrevented,
      UNRESOLVED_ORPHANS: unresolvedCount,
      repaired,
      unresolved,
    },
    orphan_discoveries: unresolvedCount
      ? unresolved.map((u) => ({
          ...u,
          status: 'BLOCKED',
          integrity: 'SYNC_ERROR',
          recommended_fix: 'Retry durable Command Center write',
        }))
      : [],
    ui_sync_health: {
      ...(working.ui_sync_health || {}),
      orphan_discovery_count: unresolvedCount,
      orphan_record_count:
        unresolvedCount ||
        (working.ui_sync_health || {}).orphan_record_count ||
        0,
      last_orphan_reconcile_at: isoNow(),
      health_state: unresolvedCount
        ? 'RED'
        : (working.ui_sync_health || {}).health_state,
    },
    integrity_verification_ok:
      unresolvedCount === 0 && working.integrity_verification_ok !== false,
    feed_updated_at: isoNow(),
  };

  return {
    ok: unresolvedCount === 0,
    ORPHAN_DISCOVERIES_FOUND: found.length,
    ORPHAN_DISCOVERIES_REPAIRED: repaired.length,
    DUPLICATES_PREVENTED: duplicatesPrevented,
    UNRESOLVED_ORPHANS: unresolvedCount,
    repaired,
    unresolved,
    found,
    feed: working,
    at: started,
  };
}

/**
 * Compare canonical opportunities vs dashboard/pipeline lists for unexplained gaps.
 */
export function comparePipelineToDashboard(feed) {
  const opps = getOpportunities(feed);
  const pipeline = getPipeline(feed);
  const dashboardIds = new Set(
    opps.map((o) => String(o.opportunity_id || o.id || o.record_id || o.lead_id)),
  );
  const pipelineIds = new Set(
    pipeline.map((o) => String(o.opportunity_id || o.id || o.record_id || o.lead_id)),
  );

  const inPipelineNotDashboard = [...pipelineIds].filter(
    (id) => id && !dashboardIds.has(id),
  );
  const discrepancies = [];

  for (const id of inPipelineNotDashboard) {
    discrepancies.push({
      id,
      problem: 'Pipeline record missing from Dashboard Feed opportunities',
    });
  }

  // Explicit disagree flag
  if (feed?.pipeline_feed_agree === false) {
    discrepancies.push({
      id: 'pipeline_feed_agree',
      problem: 'Feed declared pipeline_feed_agree=false',
    });
  }

  return {
    ok: discrepancies.length === 0,
    discrepancies,
    dashboard_count: opps.length,
    pipeline_count: pipeline.length,
  };
}
