/**
 * JS mirror of appdeploy/graph-auth.ts for deterministic local tests.
 * Production AppDeploy must use the TypeScript drop-in (secrets from @appdeploy/sdk).
 */

const LOGIN_ROOT = 'https://login.microsoftonline.com';
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const EXPIRY_SKEW_MS = 60_000;

const TENANT_GUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const TENANT_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export class GraphAuthError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'GraphAuthError';
    this.code = code;
  }
}

/** @type {{ accessToken: string, expiresAtMs: number } | null} */
let tokenCache = null;

/** @type {(name: string) => Promise<string|null|undefined>} */
let secretReader = async () => {
  throw new GraphAuthError(
    'OWNER_ACTION_REQUIRED: APPDEPLOY_SECRET_ENTRY',
    'No AppDeploy secret reader configured (local test must inject reader).',
  );
};

/** @param {(name: string) => Promise<string|null|undefined>} reader */
export function __setSecretReaderForTests(reader) {
  secretReader = reader;
  tokenCache = null;
}

export function clearGraphTokenCache() {
  tokenCache = null;
}

/** @param {string} raw */
export function normalizeGraphTenantId(raw) {
  return String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^\{+/, '')
    .replace(/\}+$/, '')
    .trim();
}

/** @param {string} tenantId */
export function graphTenantFingerprint(tenantId) {
  const t = normalizeGraphTenantId(tenantId);
  return {
    length: t.length,
    isGuidShape: TENANT_GUID_RE.test(t),
    isDomainShape: TENANT_DOMAIN_RE.test(t),
    hasForbiddenChars: /[\s{}'"\\]/.test(String(tenantId ?? '')),
  };
}

/** @param {string} raw */
export function assertValidGraphTenantId(raw) {
  const tenantId = normalizeGraphTenantId(raw);
  const fp = graphTenantFingerprint(tenantId);
  if (!tenantId || /^YOUR_|placeholder|changeme|^example$|^undefined$|^null$/i.test(tenantId)) {
    throw new GraphAuthError(
      'OWNER_ACTION_REQUIRED: GRAPH_TENANT_ID_REPAIR',
      'GRAPH_TENANT_ID is missing or placeholder after normalize.',
    );
  }
  if (!fp.isGuidShape && !fp.isDomainShape) {
    throw new GraphAuthError(
      'OWNER_ACTION_REQUIRED: GRAPH_TENANT_ID_REPAIR',
      `GRAPH_TENANT_ID is not a Directory (tenant) GUID or domain (len=${fp.length}).`,
    );
  }
  return tenantId;
}

/**
 * @param {'GRAPH_TENANT_ID'|'GRAPH_CLIENT_ID'|'GRAPH_CLIENT_SECRET'} name
 */
async function readRequiredSecret(name) {
  let raw;
  try {
    raw = await secretReader(name);
  } catch {
    throw new GraphAuthError(
      `OWNER_ACTION_REQUIRED: ${name}`,
      `${name} could not be read from AppDeploy secrets.`,
    );
  }
  const value = String(raw ?? '').trim();
  if (!value || /^YOUR_|placeholder|changeme|^example$/i.test(value)) {
    throw new GraphAuthError(
      `OWNER_ACTION_REQUIRED: ${name}`,
      `${name} is missing or placeholder in AppDeploy secrets.`,
    );
  }
  return value;
}

export async function loadGraphServiceIdentity() {
  const [tenantRaw, clientId, clientSecret] = await Promise.all([
    readRequiredSecret('GRAPH_TENANT_ID'),
    readRequiredSecret('GRAPH_CLIENT_ID'),
    readRequiredSecret('GRAPH_CLIENT_SECRET'),
  ]);
  return {
    tenantId: assertValidGraphTenantId(tenantRaw),
    clientId,
    clientSecret,
  };
}

/**
 * @param {object} [opts]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {() => number} [opts.now]
 */
export async function getGraphAccessToken(opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch.bind(globalThis);
  const nowMs = opts.now || Date.now;
  const now = nowMs();
  if (tokenCache && tokenCache.expiresAtMs - EXPIRY_SKEW_MS > now) {
    return tokenCache.accessToken;
  }

  const { tenantId, clientId, clientSecret } = await loadGraphServiceIdentity();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: GRAPH_SCOPE,
    grant_type: 'client_credentials',
  });

  const res = await fetchImpl(
    `${LOGIN_ROOT}/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    const aad = String(json.error_description || json.error || '');
    const codeMatch = aad.match(/AADSTS\d+/i);
    const aadCode = codeMatch ? codeMatch[0].toUpperCase() : '';
    if (/AADSTS900023/i.test(aad) || /neither a valid DNS name/i.test(aad)) {
      throw new GraphAuthError(
        'OWNER_ACTION_REQUIRED: GRAPH_TENANT_ID_REPAIR',
        `Graph rejected tenant identifier (HTTP ${res.status}, ${aadCode || 'AADSTS900023'}).`,
      );
    }
    if (res.status === 401 || /AADSTS7000215/i.test(aad)) {
      throw new GraphAuthError(
        'OWNER_ACTION_REQUIRED: GRAPH_SERVICE_IDENTITY_REPAIR',
        `Graph client_credentials rejected (HTTP ${res.status}${aadCode ? `, ${aadCode}` : ''}).`,
      );
    }
    throw new GraphAuthError(
      'GRAPH_TOKEN_FAILED',
      `Graph token acquisition failed (HTTP ${res.status}${aadCode ? `, ${aadCode}` : ''}).`,
    );
  }

  tokenCache = {
    accessToken: json.access_token,
    expiresAtMs: now + Math.max(60, Number(json.expires_in || 3600)) * 1000,
  };
  return tokenCache.accessToken;
}

export async function runAuthTest(opts = {}) {
  try {
    const token = await getGraphAccessToken(opts);
    if (!token || token.length < 20) {
      return { ok: false, code: 'GRAPH_TOKEN_EMPTY' };
    }
    return { ok: true, code: 'AUTH_OK' };
  } catch (err) {
    if (err instanceof GraphAuthError) {
      return { ok: false, code: err.code };
    }
    return { ok: false, code: 'GRAPH_AUTH_UNKNOWN' };
  }
}
