/**
 * Centralized Microsoft Graph HTTP client with Retry-After / backoff.
 * Never logs Authorization headers or access tokens.
 */

import { GraphTokenProvider, loadGraphCredentials } from './auth.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

/**
 * @param {number} attempt 0-based
 * @param {() => number} [rng]
 */
export function backoffMs(attempt, rng = Math.random) {
  const base = Math.min(30_000, 500 * 2 ** attempt);
  const jitter = Math.floor(rng() * 250);
  return base + jitter;
}

/**
 * Prefer Prefer: IdType="ImmutableId" for Outlook message retrieval.
 * @param {HeadersInit} [headers]
 */
export function withImmutableIdPrefer(headers = {}) {
  const h = new Headers(headers);
  const existing = h.get('Prefer') || '';
  if (!/IdType\s*=\s*"?ImmutableId"?/i.test(existing)) {
    h.set('Prefer', existing ? `${existing}, IdType="ImmutableId"` : 'IdType="ImmutableId"');
  }
  return h;
}

export class GraphHttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {{retryAfterMs?: number, requestId?: string}} [meta]
   */
  constructor(status, message, meta = {}) {
    super(message);
    this.name = 'GraphHttpError';
    this.status = status;
    this.retryAfterMs = meta.retryAfterMs;
    this.requestId = meta.requestId;
  }
}

/**
 * @typedef {object} RetryMeta
 * @property {number} attempts
 * @property {number[]} delaysMs
 * @property {number[]} statuses
 */

export class GraphClient {
  /**
   * @param {object} [opts]
   * @param {GraphTokenProvider} [opts.tokenProvider]
   * @param {typeof fetch} [opts.fetchImpl]
   * @param {number} [opts.maxAttempts]
   * @param {(meta: RetryMeta) => void} [opts.onRetry]
   * @param {() => number} [opts.rng]
   * @param {string} [opts.baseUrl]
   */
  constructor(opts = {}) {
    this.tokenProvider =
      opts.tokenProvider ||
      new GraphTokenProvider({
        loadCredentials: () => loadGraphCredentials(),
        fetchImpl: opts.fetchImpl,
      });
    this.fetchImpl = opts.fetchImpl || globalThis.fetch.bind(globalThis);
    this.maxAttempts = opts.maxAttempts ?? 5;
    this.onRetry = opts.onRetry || (() => {});
    this.rng = opts.rng || Math.random;
    this.baseUrl = opts.baseUrl || GRAPH_BASE;
  }

  /**
   * @param {string} pathOrUrl
   * @param {RequestInit & { preferImmutableId?: boolean }} [init]
   */
  async request(pathOrUrl, init = {}) {
    const url = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : `${this.baseUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;

    /** @type {RetryMeta} */
    const retryMeta = { attempts: 0, delaysMs: [], statuses: [] };
    let lastErr;

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      retryMeta.attempts = attempt + 1;
      const token = await this.tokenProvider.getAccessToken();
      let headers = new Headers(init.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('Accept', headers.get('Accept') || 'application/json');
      if (init.preferImmutableId !== false) {
        headers = withImmutableIdPrefer(headers);
      }

      const res = await this.fetchImpl(url, { ...init, headers });
      const requestId = res.headers.get('request-id') || res.headers.get('client-request-id') || undefined;

      if (res.status === 401 && attempt === 0) {
        this.tokenProvider.invalidate();
        continue;
      }

      if (res.status === 429 || res.status === 503) {
        retryMeta.statuses.push(res.status);
        const retryAfterHeader = res.headers.get('Retry-After');
        let delay;
        if (retryAfterHeader && /^\d+$/.test(retryAfterHeader.trim())) {
          delay = Number(retryAfterHeader.trim()) * 1000;
        } else if (retryAfterHeader) {
          const when = Date.parse(retryAfterHeader);
          delay = Number.isFinite(when) ? Math.max(0, when - Date.now()) : backoffMs(attempt, this.rng);
        } else {
          delay = backoffMs(attempt, this.rng);
        }
        retryMeta.delaysMs.push(delay);
        this.onRetry({ ...retryMeta });
        if (attempt < this.maxAttempts - 1) {
          await sleep(delay);
          continue;
        }
        throw new GraphHttpError(res.status, `Graph request exhausted retries (HTTP ${res.status}).`, {
          retryAfterMs: delay,
          requestId,
        });
      }

      if (!res.ok) {
        // Do not include response bodies that may contain PII/mail content in thrown messages.
        throw new GraphHttpError(res.status, `Graph request failed (HTTP ${res.status}).`, { requestId });
      }

      if (res.status === 204) return null;
      const ctype = res.headers.get('content-type') || '';
      if (ctype.includes('application/json')) return res.json();
      return res.text();
    }

    throw lastErr || new Error('Graph request failed with no response.');
  }

  get(path, init) {
    return this.request(path, { ...init, method: 'GET' });
  }

  post(path, body, init) {
    return this.request(path, {
      ...init,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      body: body == null ? undefined : JSON.stringify(body),
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
