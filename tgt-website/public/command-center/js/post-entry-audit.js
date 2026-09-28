/**
 * Post-entry self-audit after every meaningful ingestion/write.
 */
import { STATUSES } from './constants.js';
import { findDuplicateCollisions } from './dedupe.js';
import { getOpportunities } from './feed-loader.js';

const ALLOWED_TIERS = new Set(['1', '2', '3']);

export function runPostEntryAudit(feed, opportunity) {
  const failures = [];
  if (!opportunity) {
    failures.push('Canonical opportunity missing after write');
    return { ok: false, failures };
  }

  const id = opportunity.opportunity_id || opportunity.record_id || opportunity.id;
  if (!id) failures.push('Missing opportunity/record ID');

  const company = opportunity.company || opportunity.vendor;
  if (!company) failures.push('Missing company');

  const tier = String(opportunity.tier || '');
  if (!ALLOWED_TIERS.has(tier)) failures.push(`Tier not allowed: ${tier || '(empty)'}`);

  const status = String(opportunity.status || '').toUpperCase();
  if (!STATUSES.includes(status) && status !== 'DONE') {
    failures.push(`Status not allowed: ${status || '(empty)'}`);
  }

  if (!(opportunity.source || opportunity.source_evidence || opportunity.source_ref)) {
    failures.push('Missing source/evidence');
  }

  if (!opportunity.owner && opportunity.owner_action_required) {
    failures.push('Owner action flagged but owner missing');
  }

  if (!opportunity.next_action) failures.push('Missing next action');

  // Follow-up required for open Tier 1/2 unless explicitly deferred.
  const closed = ['WON', 'LOST', 'PASS', 'DONE'].includes(status);
  if (!closed && (tier === '1' || tier === '2') && !opportunity.follow_up_date && !opportunity.followup_date) {
    // Soft warning for NEW just created — still require field presence for ACCOUNT_FOR path
    if (opportunity.accounted_for) {
      failures.push('Missing follow-up date on open Tier 1/2 accounted item');
    }
  }

  const ack = String(opportunity.acknowledgement_state || '').toUpperCase();
  if (!ack) failures.push('Missing acknowledgement state');

  // Duplicate key check against feed
  const collisions = findDuplicateCollisions(getOpportunities(feed));
  const hit = collisions.some((c) =>
    c.records.some((r) => String(r.id || r.opportunity_id) === String(id)),
  );
  if (hit) failures.push('Duplicate active key collision after write');

  // Read-back: opportunity must appear in feed
  const found = getOpportunities(feed).find(
    (o) => String(o.opportunity_id || o.id || o.record_id) === String(id),
  );
  if (!found) failures.push('Read-back failed — record not in dashboard feed');

  // Dashboard agreement
  if (feed && feed.pipeline_feed_agree === false) {
    failures.push('Dashboard feed disagrees with pipeline');
  }

  return {
    ok: failures.length === 0,
    failures,
    opportunity_id: id,
    verified_at: new Date().toISOString(),
  };
}
