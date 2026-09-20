/**
 * SharePoint path helpers — canonical TEAM TGT MSP Revenue Command Center routes.
 * Detects and refuses the malformed Shared Documents/Shared Documents shell.
 */

export const CANONICAL_SITE = 'TEAM TGT MSP';
export const CANONICAL_RCC_ROOT =
  'Shared Documents/General/TGT REVENUE COMMAND CENTER';
export const CANONICAL_DASHBOARD_FEED =
  `${CANONICAL_RCC_ROOT}/10 Dashboard Feed`;
export const CANONICAL_DASHBOARD_FEED_FILE = 'TGT_DASHBOARD_FEED_2026-09-10.json';
export const CANONICAL_LEAD_INTAKE =
  `${CANONICAL_RCC_ROOT}/00 Lead Intake`;

/** Existing Graph secret names (values never belong in the browser). */
export const GRAPH_ENV_NAMES = Object.freeze([
  'GRAPH_ACCESS_TOKEN',
  'GRAPH_TENANT_ID',
  'GRAPH_CLIENT_ID',
  'GRAPH_CLIENT_SECRET',
  'GRAPH_REFRESH_TOKEN',
]);

/** Known bad / legacy shells that must not be written or linked by the UI. */
export const MALFORMED_PATH_PATTERNS = Object.freeze([
  /Shared Documents\/Shared Documents/i,
  /Documents\/Documents\/TGT/i,
  /\/Shared%20Documents\/Shared%20Documents/i,
]);

/**
 * True when a path or URL still points at the doubled Shared Documents shell.
 */
export function isMalformedSharePointPath(value) {
  const s = String(value || '');
  if (!s) return false;
  return MALFORMED_PATH_PATTERNS.some((re) => re.test(s));
}

/**
 * Normalize a SharePoint-relative path toward the canonical General/… root.
 * Does not invent folders — only collapses known double-prefix mistakes.
 */
export function normalizeSharePointPath(value) {
  let s = String(value || '').trim().replace(/\\/g, '/');
  if (!s) return CANONICAL_RCC_ROOT;
  s = s.replace(/Shared Documents\/Shared Documents/gi, 'Shared Documents');
  s = s.replace(/Documents\/Documents\//gi, 'Documents/');
  if (/^General\/TGT REVENUE COMMAND CENTER/i.test(s)) {
    s = `Shared Documents/${s}`;
  }
  if (/^TGT REVENUE COMMAND CENTER/i.test(s)) {
    s = `Shared Documents/General/${s}`;
  }
  return s;
}

/**
 * Prefer feed-provided sharepoint_path / record_path when canonical; otherwise
 * fall back to the permanent General/TGT REVENUE COMMAND CENTER root.
 */
export function resolveRecordPath(opp) {
  const raw =
    opp?.sharepoint_path ||
    opp?.record_path ||
    opp?.sp_path ||
    opp?.source_path ||
    '';
  if (raw && !isMalformedSharePointPath(raw)) {
    return normalizeSharePointPath(raw);
  }
  if (raw && isMalformedSharePointPath(raw)) {
    return {
      path: CANONICAL_RCC_ROOT,
      malformedRejected: true,
      rejected: raw,
    };
  }
  return { path: CANONICAL_RCC_ROOT, malformedRejected: false, rejected: null };
}

export function formatResolvedPath(resolved) {
  if (typeof resolved === 'string') return resolved;
  return resolved?.path || CANONICAL_RCC_ROOT;
}

/**
 * Audit a feed (or any object tree) for leftover malformed Shared Documents paths.
 * Returns matching string values — empty array means clean.
 */
export function auditMalformedPaths(value, out = [], path = '$') {
  if (value == null) return out;
  if (typeof value === 'string') {
    if (isMalformedSharePointPath(value)) out.push({ path, value });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => auditMalformedPaths(item, out, `${path}[${i}]`));
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      auditMalformedPaths(v, out, `${path}.${k}`);
    }
  }
  return out;
}
