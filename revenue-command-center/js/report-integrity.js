/**
 * Report integrity — reports consume canonical records; never primary storage.
 * Before any daily / 6 PM report: reconcile + require record_id on every item.
 */
import { reconcileOrphanDiscoveries } from './orphan-reconcile.js';
import { processDiscovery } from './discovery-pipeline.js';

function isoNow() {
  return new Date().toISOString();
}

function defaultFollowUp() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Ensure every report item has a canonical record_id.
 * Orphans are repaired via processDiscovery before the report is marked complete.
 */
export function enforceReportIntegrity(feed, reportItems = [], opts = {}) {
  const started = isoNow();
  let working = feed
    ? { ...feed, opportunities: [...(feed.opportunities || [])] }
    : null;

  if (!working) {
    return {
      ok: false,
      complete: false,
      error: 'No Command Center feed — cannot generate report',
      orphan_class: 'ORPHAN_DISCOVERY',
      feed: null,
      items: [],
      orphans_flagged: 0,
      orphans_repaired: 0,
      at: started,
    };
  }

  // Integrity reconciliation first
  if (opts.skipReconcile !== true) {
    const recon = reconcileOrphanDiscoveries(working, {
      report_items: reportItems,
      six_pm_reports: opts.sixPmReports || [],
      chatgpt_lead_reports: opts.chatgptReports || [],
    });
    working = recon.feed || working;
  }

  const items = [];
  let orphansFlagged = 0;
  let orphansRepaired = 0;
  let blocked = false;

  for (const raw of reportItems || []) {
    const recordId = raw.record_id || raw.opportunity_id || raw.lead_id || raw.id || null;
    const company = String(raw.company || raw.vendor || '').trim();
    const subject = String(
      raw.opportunity || raw.subject || raw.thread_subject || '',
    ).trim();

    if (!recordId) {
      orphansFlagged += 1;
      const repair = processDiscovery(working, {
        company: company || 'UNKNOWN',
        subject: subject || company || 'Unrecorded report lead',
        opportunity: subject || company || 'Unrecorded report lead',
        source: raw.source || 'REPORT_ITEM',
        source_ref: raw.source_ref || `report:${subject || company}`,
        thread_id: raw.thread_id || '',
        message_id: raw.message_id || '',
        tier: raw.tier != null ? String(raw.tier) : '2',
        status: raw.status || 'NEW',
        owner: raw.owner || 'Troy',
        next_action: raw.next_action || 'Qualify report orphan',
        follow_up_date: raw.follow_up_date || defaultFollowUp(),
        transmission_direction: 'INCOMING',
        message_preview: raw.message_preview || subject,
      });

      if (repair.ok && repair.opportunity) {
        working = repair.feed;
        orphansRepaired += 1;
        items.push({
          ...raw,
          record_id:
            repair.opportunity.record_id ||
            repair.opportunity.opportunity_id ||
            repair.opportunity.id,
          opportunity_id:
            repair.opportunity.opportunity_id || repair.opportunity.id,
          orphan_class: null,
          repaired: true,
          accounted_for: true,
        });
      } else {
        if (repair.feed) working = repair.feed;
        blocked = true;
        items.push({
          ...raw,
          record_id: null,
          orphan_class: 'ORPHAN_DISCOVERY',
          repaired: false,
          error: repair.error || 'Canonical write failed',
        });
      }
      continue;
    }

    // Has record_id — verify it exists in feed
    const found = (working.opportunities || []).find(
      (o) =>
        String(o.record_id || o.opportunity_id || o.id || o.lead_id) ===
        String(recordId),
    );
    if (!found) {
      orphansFlagged += 1;
      const repair = processDiscovery(working, {
        ...raw,
        company: company || found?.company || 'UNKNOWN',
        subject: subject || 'Report item missing canonical',
        opportunity_id: recordId,
        record_id: recordId,
        follow_up_date: raw.follow_up_date || defaultFollowUp(),
        source: raw.source || 'REPORT_ITEM',
      });
      if (repair.ok && repair.feed) {
        working = repair.feed;
        orphansRepaired += 1;
        items.push({
          ...raw,
          record_id: recordId,
          repaired: true,
          orphan_class: null,
        });
      } else {
        if (repair.feed) working = repair.feed;
        blocked = true;
        items.push({
          ...raw,
          record_id: recordId,
          orphan_class: 'ORPHAN_DISCOVERY',
          repaired: false,
          error: repair.error || 'Record id not in Command Center',
        });
      }
      continue;
    }

    items.push({
      ...raw,
      record_id: recordId,
      opportunity_id: found.opportunity_id || found.id,
      orphan_class: null,
      repaired: false,
    });
  }

  const complete = !blocked && orphansFlagged === orphansRepaired;
  working = {
    ...working,
    last_report_integrity: {
      at: isoNow(),
      complete,
      orphans_flagged: orphansFlagged,
      orphans_repaired: orphansRepaired,
      blocked,
    },
    integrity_verification_ok: complete && working.integrity_verification_ok !== false,
    ui_sync_health: {
      ...(working.ui_sync_health || {}),
      health_state: blocked
        ? 'RED'
        : (working.ui_sync_health || {}).health_state,
      orphan_discovery_count: blocked
        ? orphansFlagged - orphansRepaired
        : (working.ui_sync_health || {}).orphan_discovery_count || 0,
    },
  };

  return {
    ok: complete,
    complete,
    blocked,
    orphan_class: blocked ? 'ORPHAN_DISCOVERY' : null,
    orphans_flagged: orphansFlagged,
    orphans_repaired: orphansRepaired,
    items,
    feed: working,
    message: complete
      ? 'Report integrity OK — all items have canonical record IDs'
      : 'REPORT GENERATION BLOCKED — ORPHAN_DISCOVERY remains',
    at: started,
  };
}

/**
 * Build a 6 PM report view from Command Center (not independent memory).
 */
export function buildSixPmReportView(feed, opts = {}) {
  const opps = (feed?.opportunities || []).filter((o) => {
    const s = String(o.status || '').toUpperCase();
    if (opts.includeClosed) return true;
    return !['WON', 'LOST', 'PASS', 'DONE'].includes(s);
  });

  const items = opps.map((o) => ({
    record_id: o.record_id || o.opportunity_id || o.id,
    opportunity_id: o.opportunity_id || o.id,
    company: o.company || o.vendor,
    opportunity: o.opportunity || o.thread_subject || o.subject,
    tier: o.tier,
    status: o.status,
    owner: o.owner,
    next_action: o.next_action,
    follow_up_date: o.follow_up_date || o.followup_date || null,
    acknowledgement_state: o.acknowledgement_state,
    source: o.source,
  }));

  const integrity = enforceReportIntegrity(feed, items, {
    skipReconcile: opts.skipReconcile === true,
  });

  return {
    ...integrity,
    report_kind: 'SIX_PM',
    generated_at: isoNow(),
    view_of: 'COMMAND_CENTER',
    item_count: integrity.items.length,
  };
}
