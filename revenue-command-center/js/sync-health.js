/**
 * Sync health evaluation — GREEN / YELLOW / RED rules from PM brief.
 * Absent health fields never yield GREEN.
 */
import {
  HEALTH,
  HEALTH_LABELS,
  STALE_MS,
  CLOSED_STATUSES,
} from './constants.js';
import { extractHealthFields, getOpportunities, getPipeline } from './feed-loader.js';

function num(v, fallback = null) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseTime(v) {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

function isClosed(status) {
  return CLOSED_STATUSES.includes(String(status || '').toUpperCase());
}

function collectAuditRows(feed, health) {
  const rows = [];
  const push = (section, item) => {
    rows.push({
      section,
      company: item.company || item.vendor || item.name || '—',
      problem: item.problem || item.reason || item.message || section,
      source: item.source || item.source_ref || item.email_id || '—',
      status: item.status || item.current_status || '—',
      recommended_fix: item.recommended_fix || item.fix || 'Review and reconcile',
      open_source_url: item.open_source_url || item.source_url || null,
      id: item.id || item.opportunity_id || `${section}-${rows.length}`,
    });
  };

  (feed.orphan_emails || []).forEach((i) => push('Orphan Emails', i));
  (feed.orphan_records || []).forEach((i) => push('Orphan Records', i));
  (feed.orphan_discoveries || []).forEach((i) =>
    push('Orphan Discoveries', {
      ...i,
      problem: i.problem || i.error || 'ORPHAN_DISCOVERY — known to AI, missing durable Command Center write',
      recommended_fix:
        i.recommended_fix || 'Retry DISCOVER→SAVE+VERIFY before reporting',
    }),
  );
  (feed.duplicates || feed.duplicate_threads || []).forEach((i) =>
    push('Duplicate Threads', i),
  );
  (feed.stale_statuses || []).forEach((i) => push('Stale Statuses', i));
  (feed.failed_writes || []).forEach((i) => push('Failed Writes', i));
  (feed.invalid_routes || feed.bounced_routes || []).forEach((i) =>
    push('Invalid/Bounced Routes', i),
  );
  (feed.missing_source_evidence || []).forEach((i) =>
    push('Missing Source Evidence', i),
  );
  (feed.owner_actions_not_closed || []).forEach((i) =>
    push('Owner Actions Not Closed', i),
  );
  (feed.software_checklist_mismatches || []).forEach((i) =>
    push('Software Checklist Mismatches', i),
  );

  // Derive missing-source Tier 1 actives if not listed
  getOpportunities(feed).forEach((opp) => {
    if (
      String(opp.tier) === '1' &&
      !isClosed(opp.status) &&
      !opp.source &&
      !opp.source_evidence &&
      !opp.source_ref
    ) {
      push('Missing Source Evidence', {
        company: opp.company || opp.vendor,
        problem: 'Source evidence missing on active Tier 1 item',
        status: opp.status,
        id: opp.id || opp.opportunity_id,
        recommended_fix: 'Attach Outlook/SharePoint source evidence',
      });
    }
  });

  if (Array.isArray(health.verification_errors)) {
    health.verification_errors.forEach((e) => {
      push('Failed Writes', {
        problem: typeof e === 'string' ? e : e.message || 'Verification error',
        company: e.company || '—',
        status: e.status || '—',
      });
    });
  }

  return rows;
}

/**
 * Evaluate system sync health.
 * @param {object|null} feed
 * @param {{ feedReadable?: boolean, pipelineReadable?: boolean, now?: number, runtime?: object }} opts
 */
export function evaluateSyncHealth(feed, opts = {}) {
  const now = opts.now ?? Date.now();
  const runtime = opts.runtime || {};

  if (opts.feedReadable === false || !feed) {
    return {
      state: HEALTH.RED,
      label: HEALTH_LABELS.RED,
      message: opts.feedError || 'Dashboard Feed cannot be read',
      metrics: zeroMetrics(),
      reasons: ['Dashboard Feed cannot be read'],
      auditRows: [],
      healthFieldsPresent: false,
      incompleteHealthFields: true,
    };
  }

  if (opts.pipelineReadable === false || feed.pipeline_reachable === false) {
    return {
      state: HEALTH.RED,
      label: HEALTH_LABELS.RED,
      message: 'Pipeline cannot be read',
      metrics: metricsFromFeed(feed, {}),
      reasons: ['Pipeline cannot be read'],
      auditRows: collectAuditRows(feed, extractHealthFields(feed)),
      healthFieldsPresent: false,
      incompleteHealthFields: true,
    };
  }

  const health = extractHealthFields(feed);
  const requiredKeys = [
    'health_state',
    'last_verified_at',
    'orphan_email_count',
    'orphan_record_count',
    'duplicate_count',
    'invalid_route_count',
    'failed_write_count',
    'stale_record_count',
  ];
  const missingKeys = requiredKeys.filter((k) => health[k] === undefined);
  const incompleteHealthFields = missingKeys.length > 0;

  const metrics = metricsFromFeed(feed, health, runtime);
  const reasons = [];
  const yellowReasons = [];

  // RED conditions
  if (feed.feed_reachable === false) {
    reasons.push('Dashboard Feed cannot be read');
  }
  if (num(metrics.failed_write_count, 0) > 0 || runtime.unverifiedFailedWrite) {
    reasons.push('A write failed and was not verified');
  }
  if (num(metrics.duplicate_count, 0) > 0) {
    reasons.push('Duplicate active records exist for the same opportunity/thread');
  }
  if (num(metrics.orphan_email_count, 0) > 0) {
    reasons.push('Meaningful Outlook activity exists with no corresponding tracker record');
  }
  if (num(metrics.orphan_discovery_count, 0) > 0) {
    reasons.push('Unprocessed ORPHAN_DISCOVERY — AI-known lead missing durable Command Center record');
  }
  if (Array.isArray(feed.orphan_discoveries) && feed.orphan_discoveries.length > 0) {
    reasons.push('Orphan discovery queue is not empty');
  }
  if (feed.pipeline_feed_agree === false) {
    reasons.push('Tracker and feed materially disagree');
  }
  if (Array.isArray(health.verification_errors) && health.verification_errors.length) {
    reasons.push('Verification errors present');
  }
  if (runtime.verificationFailed) {
    reasons.push('Write succeeded but read-back verification failed');
  }

  const opps = getOpportunities(feed);
  const missingTier = opps.filter(
    (o) =>
      String(o.tier) === '1' &&
      !isClosed(o.status) &&
      !(o.source || o.source_evidence || o.source_ref),
  );
  if (missingTier.length) {
    reasons.push('Source evidence is missing on an active Tier 1 item');
  }

  // YELLOW conditions
  if (num(metrics.stale_record_count, 0) > 0) {
    yellowReasons.push('Records are stale');
  }
  const feedUpdated = parseTime(feed.feed_updated_at || feed.generated_at);
  if (feedUpdated && now - feedUpdated > STALE_MS) {
    yellowReasons.push('Feed timestamp is stale (>24h)');
  }
  const lastAudit = parseTime(health.last_full_audit_at);
  if (health.last_full_audit_at !== undefined) {
    if (!lastAudit || now - lastAudit > STALE_MS * 7) {
      yellowReasons.push('An audit is overdue');
    }
  }
  opps.forEach((o) => {
    if (
      String(o.status).toUpperCase() === 'OWNER_ACTION' &&
      o.last_verified_at &&
      now - (parseTime(o.last_verified_at) || 0) > STALE_MS
    ) {
      yellowReasons.push('An owner-action record lacks fresh verification');
    }
  });
  if (feed.noncritical_mismatch) {
    yellowReasons.push('A noncritical mismatch exists');
  }
  if (incompleteHealthFields) {
    yellowReasons.push('Health verification incomplete.');
  }

  const uiChecks =
    feed.ui_sync_health && typeof feed.ui_sync_health === 'object'
      ? feed.ui_sync_health.checks
      : null;
  const mailboxCoverageVerified =
    feed.mailbox_coverage_verified === true ||
    (uiChecks && uiChecks.mailbox_coverage === 'PASS');
  if (!mailboxCoverageVerified) {
    yellowReasons.push('Full mailbox coverage is not verified.');
  }
  const appRuntimeReadbackBlocked =
    uiChecks && uiChecks.app_runtime_record_readback === 'BLOCKED';
  if (appRuntimeReadbackBlocked) {
    yellowReasons.push('App runtime record read-back is blocked.');
  }
  const declaredUiStatus = String(
    (feed.ui_sync_health && feed.ui_sync_health.status) || health.health_state || '',
  ).toUpperCase();
  if (declaredUiStatus === 'BLOCKED') {
    yellowReasons.push('Feed ui_sync_health.status is BLOCKED.');
  }

  // Integrity verification required for GREEN / SYNCED
  // SYNCED means: reconciled + email ingestion checked + no failed writes + no orphans + verified.
  const integrityOk =
    feed.integrity_verification_ok === true ||
    health.integrity_verification_ok === true ||
    (health.last_full_audit_at &&
      lastAudit &&
      feed.pipeline_feed_agree !== false &&
      !incompleteHealthFields);

  let state = HEALTH.GREEN;
  let message = HEALTH_LABELS.GREEN;

  if (reasons.length) {
    state = HEALTH.RED;
    message = HEALTH_LABELS.RED;
  } else if (incompleteHealthFields) {
    state = HEALTH.YELLOW;
    message = 'Health verification incomplete.';
  } else if (!mailboxCoverageVerified) {
    // Do not claim SYSTEM SYNCED until mailbox coverage/backfill is proven.
    state = HEALTH.YELLOW;
    message = 'REVIEW REQUIRED — Full mailbox coverage is not verified.';
  } else if (yellowReasons.length || !integrityOk) {
    state = HEALTH.YELLOW;
    message = HEALTH_LABELS.YELLOW;
    if (!integrityOk && !yellowReasons.includes('Last full integrity verification incomplete')) {
      yellowReasons.push('Last full integrity verification incomplete');
    }
  } else if (
    // Explicit GREEN only when all green gates pass — including mailbox coverage
    feed.feed_reachable !== false &&
    feed.pipeline_reachable !== false &&
    feed.pipeline_feed_agree !== false &&
    num(metrics.failed_write_count, 0) === 0 &&
    num(metrics.duplicate_count, 0) === 0 &&
    num(metrics.orphan_email_count, 0) === 0 &&
    num(metrics.orphan_discovery_count, 0) === 0 &&
    num(metrics.invalid_route_count, 0) === 0 &&
    mailboxCoverageVerified &&
    integrityOk
  ) {
    state = HEALTH.GREEN;
    message = HEALTH_LABELS.GREEN;
  } else {
    state = HEALTH.YELLOW;
    message = HEALTH_LABELS.YELLOW;
  }

  // Feed-declared health_state can escalate severity but never invent GREEN alone
  const declared = String(health.health_state || declaredUiStatus || '').toUpperCase();
  if (declared === 'RED' && state !== HEALTH.RED) {
    state = HEALTH.RED;
    message = HEALTH_LABELS.RED;
    reasons.push('Feed declared health_state=RED');
  } else if (declared === 'BLOCKED' && state === HEALTH.GREEN) {
    state = HEALTH.YELLOW;
    message = 'REVIEW REQUIRED — Feed ui_sync_health.status is BLOCKED.';
    yellowReasons.push('Feed declared health_state=BLOCKED');
  } else if (declared === 'YELLOW' && state === HEALTH.GREEN) {
    state = HEALTH.YELLOW;
    message = HEALTH_LABELS.YELLOW;
    yellowReasons.push('Feed declared health_state=YELLOW');
  } else if (appRuntimeReadbackBlocked && state === HEALTH.GREEN) {
    state = HEALTH.YELLOW;
    message = 'REVIEW REQUIRED — App runtime record read-back is blocked.';
  }

  return {
    state,
    label: state === HEALTH.YELLOW && incompleteHealthFields
      ? 'Health verification incomplete.'
      : message,
    metrics,
    reasons,
    yellowReasons,
    auditRows: collectAuditRows(feed, health),
    healthFieldsPresent: Object.keys(health).length > 0,
    incompleteHealthFields,
    missingKeys,
    lastVerifiedAt: health.last_verified_at || null,
    feedUpdatedAt: feed.feed_updated_at || feed.generated_at || null,
    actionsLocked: state === HEALTH.RED,
    mailboxCoverageVerified,
    mailboxCoverageWarning: mailboxCoverageVerified
      ? null
      : 'Full mailbox coverage is not verified.',
    finalSyncState:
      state === HEALTH.GREEN && mailboxCoverageVerified && reasons.length === 0
        ? 'VERIFIED SYNCED'
        : 'OUT OF SYNC — BLOCKERS REMAIN',
  };
}

function zeroMetrics() {
  return {
    orphan_email_count: null,
    orphan_record_count: null,
    orphan_discovery_count: null,
    duplicate_count: null,
    invalid_route_count: null,
    failed_write_count: null,
    stale_record_count: null,
  };
}

function metricsFromFeed(feed, health, runtime = {}) {
  const fromList = (arr) => (Array.isArray(arr) ? arr.length : null);
  return {
    orphan_email_count:
      num(health.orphan_email_count, null) ??
      fromList(feed.orphan_emails) ??
      0,
    orphan_record_count:
      num(health.orphan_record_count, null) ??
      fromList(feed.orphan_records) ??
      0,
    orphan_discovery_count:
      num(health.orphan_discovery_count, null) ??
      fromList(feed.orphan_discoveries) ??
      0,
    duplicate_count:
      num(health.duplicate_count, null) ??
      fromList(feed.duplicates || feed.duplicate_threads) ??
      0,
    invalid_route_count:
      num(health.invalid_route_count, null) ??
      fromList(feed.invalid_routes || feed.bounced_routes) ??
      0,
    failed_write_count:
      num(health.failed_write_count, null) ??
      fromList(feed.failed_writes) ??
      (runtime.unverifiedFailedWrite ? 1 : 0),
    stale_record_count:
      num(health.stale_record_count, null) ??
      fromList(feed.stale_statuses) ??
      countStaleOpps(feed),
  };
}

function countStaleOpps(feed) {
  const now = Date.now();
  return getOpportunities(feed).filter((o) => {
    const t = parseTime(o.last_verified_at);
    return t && now - t > STALE_MS && !isClosed(o.status);
  }).length;
}

export function formatMetric(v) {
  return v === null || v === undefined ? '—' : String(v);
}
