/**
 * Feed loader — reads dashboard feed JSON only.
 * Never invents statuses. Missing health fields → incomplete (YELLOW), not GREEN.
 */
import { SCHEMA_VERSION } from './constants.js';
import {
  CANONICAL_DASHBOARD_FEED,
  CANONICAL_DASHBOARD_FEED_FILE,
  GRAPH_ENV_NAMES,
} from './paths.js';
import { sortOpportunities } from './sorting.js';

/**
 * @typedef {object} DashboardFeed
 * @property {string} [schema_version]
 * @property {string} [feed_updated_at]
 * @property {string} [generated_at]
 * @property {object} [ui_sync_health]
 * @property {string} [health_state]
 * @property {string} [last_verified_at]
 * @property {string} [last_full_audit_at]
 * @property {number} [orphan_email_count]
 * @property {number} [orphan_record_count]
 * @property {number} [duplicate_count]
 * @property {number} [invalid_route_count]
 * @property {number} [failed_write_count]
 * @property {number} [stale_record_count]
 * @property {Array} [verification_errors]
 * @property {object} [audit_summary]
 * @property {Array} [opportunities]
 * @property {Array} [pipeline]
 * @property {Array} [pipeline_records]
 * @property {Array} [orphan_emails]
 * @property {Array} [orphan_records]
 * @property {Array} [duplicates]
 * @property {Array} [failed_writes]
 * @property {Array} [invalid_routes]
 * @property {Array} [software_checklist]
 * @property {boolean} [pipeline_feed_agree]
 * @property {boolean} [feed_reachable]
 * @property {boolean} [pipeline_reachable]
 * @property {boolean} [integrity_verification_ok]
 */

export function emptyFeedError(reason) {
  return {
    ok: false,
    error: reason,
    feed: null,
    loadedAt: new Date().toISOString(),
  };
}

/**
 * Normalize nested or flat health fields from feed.
 * Does not fabricate GREEN when fields are absent.
 */
export function extractHealthFields(feed) {
  const h = feed?.ui_sync_health && typeof feed.ui_sync_health === 'object'
    ? feed.ui_sync_health
    : {};

  const pick = (key) => {
    if (Object.prototype.hasOwnProperty.call(h, key)) return h[key];
    if (Object.prototype.hasOwnProperty.call(feed || {}, key)) return feed[key];
    return undefined;
  };

  const present = {};
  const keys = [
    'health_state',
    'last_verified_at',
    'last_full_audit_at',
    'orphan_email_count',
    'orphan_record_count',
    'duplicate_count',
    'invalid_route_count',
    'failed_write_count',
    'stale_record_count',
    'verification_errors',
    'audit_summary',
  ];
  for (const key of keys) {
    const v = pick(key);
    if (v !== undefined) present[key] = v;
  }
  return present;
}

export function getOpportunities(feed) {
  if (!feed) return [];
  if (Array.isArray(feed.opportunities)) return feed.opportunities;
  if (Array.isArray(feed.records)) return feed.records;
  return [];
}

export function getPipeline(feed) {
  if (!feed) return [];
  if (Array.isArray(feed.pipeline)) return feed.pipeline;
  if (Array.isArray(feed.pipeline_records)) return feed.pipeline_records;
  return [];
}

/**
 * Live SharePoint 10 Dashboard Feed is server-side Graph only.
 * The browser must not receive Graph secrets.
 */
export function liveDashboardFeedUnavailableReason() {
  const names = GRAPH_ENV_NAMES.join(', ');
  return (
    `Live SharePoint 10 Dashboard Feed is not connected. Canonical path: TEAM TGT MSP / ${CANONICAL_DASHBOARD_FEED} / ${CANONICAL_DASHBOARD_FEED_FILE}. ` +
    `Required env (existing names only, not present in this process for the UI): ${names}.`
  );
}

/**
 * Load the live dashboard feed. Uses a proxy URL if provided; never invents GREEN.
 */
export async function loadLiveDashboardFeed(proxyUrl) {
  const url = String(proxyUrl || '').trim();
  if (!url) {
    return emptyFeedError(liveDashboardFeedUnavailableReason());
  }
  return loadFeedFromUrl(url);
}

/**
 * Load feed JSON from a URL (local fixtures/feeds). Not a new database.
 */
export async function loadFeedFromUrl(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body && typeof body.error === 'string' && body.error.trim()) {
          detail = body.error.trim();
        }
      } catch {
        /* keep HTTP status */
      }
      return emptyFeedError(`Dashboard Feed cannot be read (${detail}).`);
    }
    const feed = applyNewestFirst(await res.json());
    return {
      ok: true,
      error: null,
      feed,
      loadedAt: new Date().toISOString(),
      sourceUrl: url,
      schemaVersion: feed?.schema_version || null,
      schemaExpected: SCHEMA_VERSION,
    };
  } catch (err) {
    return emptyFeedError(
      `Dashboard Feed cannot be read: ${err && err.message ? err.message : String(err)}`,
    );
  }
}

/**
 * Newest First on lead arrays. Closed items stay last via sortOpportunities.
 */
export function applyNewestFirst(feed) {
  if (!feed || typeof feed !== 'object') return feed;
  const next = { ...feed };
  if (Array.isArray(next.opportunities)) next.opportunities = sortOpportunities(next.opportunities);
  if (Array.isArray(next.records)) next.records = sortOpportunities(next.records);
  return next;
}

/**
 * Parse feed from raw JSON string (tests / paste).
 */
export function loadFeedFromJson(jsonText) {
  try {
    const parsed = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    if (!parsed || typeof parsed !== 'object') {
      return emptyFeedError('Dashboard Feed cannot be read: invalid JSON object.');
    }
    const feed = applyNewestFirst(parsed);
    return {
      ok: true,
      error: null,
      feed,
      loadedAt: new Date().toISOString(),
      schemaVersion: feed.schema_version || null,
      schemaExpected: SCHEMA_VERSION,
    };
  } catch (err) {
    return emptyFeedError(
      `Dashboard Feed cannot be read: ${err && err.message ? err.message : String(err)}`,
    );
  }
}
