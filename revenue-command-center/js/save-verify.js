/**
 * Save + read-back verification. Never show bare "Saved".
 * Ephemeral working copy only — SharePoint feed remains source of truth.
 */
export function applyOpportunityPatch(feed, opportunityId, patch) {
  const opps = Array.isArray(feed.opportunities)
    ? feed.opportunities.map((o) => ({ ...o }))
    : [];
  const idx = opps.findIndex(
    (o) => String(o.id || o.opportunity_id) === String(opportunityId),
  );
  if (idx < 0) {
    return { ok: false, error: 'Opportunity not found in feed working copy' };
  }
  opps[idx] = {
    ...opps[idx],
    ...patch,
    last_write_at: new Date().toISOString(),
  };
  return {
    ok: true,
    feed: { ...feed, opportunities: opps },
    written: opps[idx],
  };
}

/**
 * Simulate write then read-back against expected status/next_action and feed agreement.
 * @param {{ simulateReadbackFail?: boolean }} opts
 */
export function saveAndVerify(feed, opportunityId, patch, opts = {}) {
  const write = applyOpportunityPatch(feed, opportunityId, patch);
  if (!write.ok) {
    return {
      status: 'WRITE_FAILED',
      message: 'SAVE FAILED',
      healthForce: 'RED',
      feed,
      error: write.error,
    };
  }

  // Read-back
  if (opts.simulateReadbackFail) {
    return {
      status: 'VERIFICATION_FAILED',
      message: 'SAVED — VERIFICATION FAILED',
      healthForce: 'RED',
      feed: write.feed,
      written: write.written,
      readback: null,
    };
  }

  const readback = (write.feed.opportunities || []).find(
    (o) => String(o.id || o.opportunity_id) === String(opportunityId),
  );
  const statusOk =
    !patch.status ||
    String(readback?.status).toUpperCase() === String(patch.status).toUpperCase();
  const nextOk =
    patch.next_action === undefined ||
    String(readback?.next_action || '') === String(patch.next_action || '');
  const feedAgrees = write.feed.pipeline_feed_agree !== false;

  if (!readback || !statusOk || !nextOk || !feedAgrees) {
    return {
      status: 'VERIFICATION_FAILED',
      message: 'SAVED — VERIFICATION FAILED',
      healthForce: 'RED',
      feed: write.feed,
      written: write.written,
      readback,
    };
  }

  return {
    status: 'SAVED_VERIFIED',
    message: 'SAVED + VERIFIED',
    healthForce: null,
    feed: write.feed,
    written: write.written,
    readback,
  };
}
