/**
 * Feed loader — reads dashboard feed JSON only.
 * Never invents statuses. Missing health fields → incomplete (YELLOW), not GREEN.
 */
import { SCHEMA_VERSION } from './constants.js';

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
 * Load feed JSON from a URL (local fixtures/feeds). Not a new database.
 */
export async function loadFeedFromUrl(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return emptyFeedError(`Dashboard Feed cannot be read (HTTP ${res.status}).`);
    }
    const feed = await res.json();
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
 * Candidate live-feed export locations under ./feeds/. The exact dated filename
 * varies (Troy syncs it from SharePoint), so we try a manifest first, then a
 * few known/dated names. This is a READ path for local UI dev only — never a
 * second database, and never fabricated GREEN when absent.
 */
export const LIVE_FEED_CANDIDATES = Object.freeze([
  './feeds/TGT_DASHBOARD_FEED_2026-09-10.json',
  './feeds/TGT_DASHBOARD_FEED_LATEST.json',
  './feeds/latest.json',
]);

/**
 * Attempt to load a live dashboard feed export from ./feeds/.
 * Order: optional manifest (feeds/index.json → { feed: "<name>" } or an array
 * of names) then the known candidate list. Returns the first readable feed.
 * When none are present/readable, returns an emptyFeedError — the caller must
 * surface YELLOW-incomplete (never GREEN), per feeds/README.md.
 *
 * @param {string} [baseDir='./feeds']
 * @returns {Promise<{ok:boolean, feed:object|null, error:string|null, sourceUrl?:string}>}
 */
export async function loadLiveDashboardFeed(baseDir = './feeds') {
  const tried = [];
  const candidates = [];

  // 1) Optional manifest so a single index file can point at the live export.
  try {
    const manifestUrl = `${baseDir}/index.json`;
    const res = await fetch(manifestUrl, { cache: 'no-store' });
    if (res.ok) {
      const manifest = await res.json();
      const names = Array.isArray(manifest)
        ? manifest
        : Array.isArray(manifest?.feeds)
          ? manifest.feeds
          : manifest?.feed
            ? [manifest.feed]
            : [];
      for (const n of names) {
        if (typeof n === 'string' && n.trim()) {
          candidates.push(/^\.?\//.test(n) ? n : `${baseDir}/${n}`);
        }
      }
    }
  } catch {
    /* no manifest — fall back to known candidates */
  }

  for (const c of LIVE_FEED_CANDIDATES) candidates.push(c);

  for (const url of candidates) {
    tried.push(url);
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const feed = await res.json();
      if (feed && typeof feed === 'object') {
        return {
          ok: true,
          error: null,
          feed,
          loadedAt: new Date().toISOString(),
          sourceUrl: url,
          schemaVersion: feed?.schema_version || null,
          schemaExpected: SCHEMA_VERSION,
        };
      }
    } catch {
      /* try the next candidate */
    }
  }

  return emptyFeedError(
    `No live Dashboard Feed export found under ${baseDir}/ (tried ${tried.length} location(s)). ` +
      'Showing YELLOW — incomplete; place a TGT_DASHBOARD_FEED_*.json export here when Troy syncs it.',
  );
}

/**
 * Parse feed from raw JSON string (tests / paste).
 */
export function loadFeedFromJson(jsonText) {
  try {
    const feed = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    if (!feed || typeof feed !== 'object') {
      return emptyFeedError('Dashboard Feed cannot be read: invalid JSON object.');
    }
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
