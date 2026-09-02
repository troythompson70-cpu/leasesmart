/**
 * LeaseSmart regression helper — shared LS_BUILD parsing and ordering.
 *
 * Build ids are `YYYYMMDD-vMAJOR.MINOR.PATCH` with an optional slug
 * (`20260530-v2.14.0-data-a1`). Suites assert the shipped build parses and is
 * no older than the build their sprint shipped in, so bumping LS_BUILD for a
 * new sprint does not require editing every earlier suite's allowlist.
 */

const BUILD_ID_RE = /^(\d{8})-v(\d+)\.(\d+)\.(\d+)(?:-([a-z0-9-]+))?$/;

export function readBuildId(html) {
  const match = String(html || '').match(/LS_BUILD = '([^']+)'/);
  return match ? match[1] : null;
}

export function parseBuildId(id) {
  const match = typeof id === 'string' ? id.match(BUILD_ID_RE) : null;
  if (!match) return null;
  return {
    date: match[1],
    major: Number(match[2]),
    minor: Number(match[3]),
    patch: Number(match[4]),
    slug: match[5] || '',
  };
}

export function isValidBuildId(id) {
  return parseBuildId(id) !== null;
}

/**
 * Returns -1, 0 or 1 comparing two build ids, or null if either is malformed.
 * Version segments compare numerically so v2.10.0 sorts after v2.9.0.
 */
export function compareBuildIds(a, b) {
  const left = parseBuildId(a);
  const right = parseBuildId(b);
  if (!left || !right) return null;
  if (left.date !== right.date) return left.date < right.date ? -1 : 1;
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  return 0;
}

/**
 * True when index.html ships a well-formed build id that is `minimum` or newer.
 */
export function buildAtLeast(html, minimum) {
  const shipped = readBuildId(html);
  const order = compareBuildIds(shipped, minimum);
  return order !== null && order >= 0;
}
