/**
 * Server-side Microsoft Graph client-credentials auth.
 * Secrets MUST come from protected runtime env — never frontend, never logs.
 */

const TOKEN_URL_TMPL = 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token';
const DEFAULT_SCOPE = 'https://graph.microsoft.com/.default';

/** Clock skew buffer before treating a token as expired (ms). */
const EXPIRY_SKEW_MS = 60_000;

export class GraphCredentialError extends Error {
  /**
   * @param {string} code OWNER_ACTION_REQUIRED code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'GraphCredentialError';
    this.code = code;
  }
}

/**
 * Read required Graph env vars without echoing values.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadGraphCredentials(env = process.env) {
  const tenantId = String(env.GRAPH_TENANT_ID || '').trim();
  const clientId = String(env.GRAPH_CLIENT_ID || '').trim();
  const clientSecret = String(env.GRAPH_CLIENT_SECRET || '').trim();

  if (!tenantId) {
    throw new GraphCredentialError(
      'OWNER_ACTION_REQUIRED: GRAPH_TENANT_ID',
      'GRAPH_TENANT_ID is missing from protected runtime secrets.',
    );
  }
  if (!clientId) {
    throw new GraphCredentialError(
      'OWNER_ACTION_REQUIRED: GRAPH_CLIENT_ID',
      'GRAPH_CLIENT_ID is missing from protected runtime secrets.',
    );
  }
  if (!clientSecret) {
    throw new GraphCredentialError(
      'OWNER_ACTION_REQUIRED: GRAPH_CLIENT_SECRET',
      'GRAPH_CLIENT_SECRET is missing from protected runtime secrets.',
    );
  }

  return { tenantId, clientId, clientSecret, scope: DEFAULT_SCOPE };
}

/**
 * @typedef {object} TokenCacheEntry
 * @property {string} accessToken
 * @property {number} expiresAtMs
 */

/**
 * In-memory token cache keyed by tenant+client+scope.
 * Never log accessToken.
 */
export class GraphTokenProvider {
  /**
   * @param {object} opts
   * @param {() => {tenantId:string,clientId:string,clientSecret:string,scope:string}} opts.loadCredentials
   * @param {typeof fetch} [opts.fetchImpl]
   * @param {() => number} [opts.now]
   * @param {Map<string, TokenCacheEntry>} [opts.cache]
   */
  constructor(opts) {
    this.loadCredentials = opts.loadCredentials;
    this.fetchImpl = opts.fetchImpl || globalThis.fetch.bind(globalThis);
    this.now = opts.now || (() => Date.now());
    this.cache = opts.cache || new Map();
  }

  cacheKey(creds) {
    return `${creds.tenantId}|${creds.clientId}|${creds.scope}`;
  }

  /**
   * @returns {Promise<string>} access token (caller must not log)
   */
  async getAccessToken() {
    const creds = this.loadCredentials();
    const key = this.cacheKey(creds);
    const hit = this.cache.get(key);
    const now = this.now();
    if (hit && hit.expiresAtMs - EXPIRY_SKEW_MS > now) {
      return hit.accessToken;
    }

    const url = TOKEN_URL_TMPL.replace('{tenant}', encodeURIComponent(creds.tenantId));
    const body = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: creds.scope,
      grant_type: 'client_credentials',
    });

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Graph token endpoint returned non-JSON (HTTP ${res.status}).`);
    }

    if (!res.ok) {
      const errCode = String(json.error || '');
      if (
        res.status === 400 &&
        (errCode === 'unauthorized_client' || errCode === 'invalid_client')
      ) {
        throw new GraphCredentialError(
          'OWNER_ACTION_REQUIRED: MICROSOFT_ADMIN_CONSENT',
          'Graph token acquisition failed — check Entra app credentials and admin consent.',
        );
      }
      // Never include client_secret or access_token in error messages.
      throw new Error(
        `Graph token acquisition failed (HTTP ${res.status}, error=${errCode || 'unknown'}).`,
      );
    }

    const accessToken = String(json.access_token || '');
    const expiresIn = Number(json.expires_in || 3600);
    if (!accessToken) {
      throw new Error('Graph token response missing access_token.');
    }

    this.cache.set(key, {
      accessToken,
      expiresAtMs: now + Math.max(60, expiresIn) * 1000,
    });
    return accessToken;
  }

  /** Drop cached tokens (e.g. after 401). */
  invalidate() {
    this.cache.clear();
  }
}
