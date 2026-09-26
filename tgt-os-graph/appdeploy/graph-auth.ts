/**
 * AppDeploy production Graph auth — DROP-IN for backend/graph-auth.ts
 *
 * ROOT DEFECT (v98): hard-coded GRAPH_TENANT_ID + GRAPH_CLIENT_ID with only
 * GRAPH_CLIENT_SECRET from AppDeploy secrets → AADSTS7000215 when secret
 * does not belong to the hard-coded client.
 *
 * LIVE FAILURE (2026-09-22): AADSTS900023 after repeated secret UI edits —
 * tenant VALUE reaching login.microsoftonline.com was still malformed
 * (braces/quotes/whitespace/BOM) or not validated before the token call.
 * MAILBOX GAP is the UI symptom; 900023 is the Graph cause.
 *
 * REQUIRED: all three identities from secrets.readSecret() only.
 * Never process.env for AppDeploy tenant secrets.
 * Never hard-code tenant/client UUIDs.
 * Never log secret or access-token values.
 *
 * Permissions architecture (Entra, not this file): Mail.Read + Sites.ReadWrite.All only.
 * Do not call Mail.Send from this module.
 *
 * Baseline: v98 / 1789910277389 FROZEN_FOR_GRAPH_REPAIR (v44 rollback-only).
 * Do not re-enable sledgehammer-production-sweep-v3 until AUTH_TEST passes.
 */

import { secrets } from '@appdeploy/sdk';

const LOGIN_ROOT = 'https://login.microsoftonline.com';
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const EXPIRY_SKEW_MS = 60_000;

/** Entra Directory (tenant) ID GUID shape */
const TENANT_GUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
/** Tenant DNS / onmicrosoft domain (not a GUID) */
const TENANT_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const GRAPH_SECRET_NAMES = [
  'GRAPH_TENANT_ID',
  'GRAPH_CLIENT_ID',
  'GRAPH_CLIENT_SECRET',
] as const;

export type GraphSecretName = (typeof GRAPH_SECRET_NAMES)[number];

export class GraphAuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'GraphAuthError';
    this.code = code;
  }
}

type TokenCache = { accessToken: string; expiresAtMs: number };
let tokenCache: TokenCache | null = null;

/** Test seam — production uses @appdeploy/sdk secrets.readSecret */
export type SecretReader = (name: string) => Promise<string | null | undefined>;

let secretReader: SecretReader = async (name) => secrets.readSecret(name);

/** @internal test-only */
export function __setSecretReaderForTests(reader: SecretReader | null): void {
  secretReader = reader || (async (name) => secrets.readSecret(name));
  tokenCache = null;
}

export function clearGraphTokenCache(): void {
  tokenCache = null;
}

/**
 * Strip paste junk that causes AADSTS900023 even when "a tenant id was entered".
 * Never logs the value.
 */
export function normalizeGraphTenantId(raw: string): string {
  return String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^\{+/, '')
    .replace(/\}+$/, '')
    .trim();
}

/**
 * Safe fingerprint for operator logs — never returns the secret value.
 */
export function graphTenantFingerprint(tenantId: string): {
  length: number;
  isGuidShape: boolean;
  isDomainShape: boolean;
  hasForbiddenChars: boolean;
} {
  const t = normalizeGraphTenantId(tenantId);
  return {
    length: t.length,
    isGuidShape: TENANT_GUID_RE.test(t),
    isDomainShape: TENANT_DOMAIN_RE.test(t),
    hasForbiddenChars: /[\s{}'"\\]/.test(String(tenantId ?? '')),
  };
}

export function assertValidGraphTenantId(raw: string): string {
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
      `GRAPH_TENANT_ID is not a Directory (tenant) GUID or domain (len=${fp.length}). Re-copy Tenant ID from Entra Overview — no braces/quotes.`,
    );
  }
  return tenantId;
}

async function readRequiredSecret(name: GraphSecretName): Promise<string> {
  let raw: string | null | undefined;
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

/**
 * Load tenant + client + secret exclusively from AppDeploy protected secrets.
 * Never returns secret values to callers beyond the credential object used for token POST.
 */
export async function loadGraphServiceIdentity(): Promise<{
  tenantId: string;
  clientId: string;
  clientSecret: string;
}> {
  const [tenantRaw, clientId, clientSecret] = await Promise.all([
    readRequiredSecret('GRAPH_TENANT_ID'),
    readRequiredSecret('GRAPH_CLIENT_ID'),
    readRequiredSecret('GRAPH_CLIENT_SECRET'),
  ]);
  const tenantId = assertValidGraphTenantId(tenantRaw);
  return { tenantId, clientId, clientSecret };
}

/**
 * AUTH_TEST / production token acquisition — client_credentials only.
 * Caches short-lived access tokens. Never logs the token.
 */
export async function getGraphAccessToken(nowMs: () => number = Date.now): Promise<string> {
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

  const res = await fetch(
    `${LOGIN_ROOT}/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_codes?: number[];
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    const aad = String(json.error_description || json.error || '');
    // Never include client_secret. Surface AADSTS code only.
    const codeMatch = aad.match(/AADSTS\d+/i);
    const aadCode = codeMatch ? codeMatch[0].toUpperCase() : '';
    if (/AADSTS900023/i.test(aad) || /neither a valid DNS name/i.test(aad)) {
      throw new GraphAuthError(
        'OWNER_ACTION_REQUIRED: GRAPH_TENANT_ID_REPAIR',
        `Graph rejected tenant identifier (HTTP ${res.status}, ${aadCode || 'AADSTS900023'}). Fix GRAPH_TENANT_ID to Entra Directory (tenant) ID GUID — no braces/quotes.`,
      );
    }
    if (res.status === 401 || /AADSTS7000215/i.test(aad)) {
      throw new GraphAuthError(
        'OWNER_ACTION_REQUIRED: GRAPH_SERVICE_IDENTITY_REPAIR',
        `Graph client_credentials rejected (HTTP ${res.status}${aadCode ? `, ${aadCode}` : ''}). Confirm Entra app secret VALUE matches GRAPH_CLIENT_ID.`,
      );
    }
    if (/unauthorized_client|invalid_client|AADSTS65001|consent/i.test(aad)) {
      throw new GraphAuthError(
        'OWNER_ACTION_REQUIRED: MICROSOFT_ADMIN_CONSENT',
        `Graph token acquisition failed (HTTP ${res.status}). Check admin consent for Mail.Read + Sites.ReadWrite.All.`,
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

/** AUTH_TEST helper — returns ok/code without leaking secrets. */
export async function runAuthTest(): Promise<{
  ok: boolean;
  code: string;
  httpStatus?: number;
}> {
  try {
    const token = await getGraphAccessToken();
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
