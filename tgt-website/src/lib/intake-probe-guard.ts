/**
 * Hard ban: automated/CI probes must never create live Exchange traffic.
 *
 * Production `/api/intake` on tgttechnologies.com sends real mailbox traffic
 * (including "Welcome to TGT Tips") and fabricated addresses NDR into
 * info@tgttechnologies.com. Local Vite `/api/intake` is mock-only (no SMTP).
 */

const PRODUCTION_HOST_RE = /(^|\.)tgttechnologies\.com$/i

/** Local / preview / non-production hosts where fabricated emails are allowed. */
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i

/**
 * Fabricated addresses previously used by Cursor overnight/live harnesses.
 * Keep this list tight and explicit.
 */
const PROBE_LOCAL_PART_RE =
  /^(live-diag|overnight-gateway|overnight-bridge|overnight-puppeteer|live-sp-map|final-check|live-ui-e2e|live-v3|cors2|cors-test|status-test)([-+._].*)?$/i

const PROBE_DOMAIN_RE =
  /^(example\.com|example\.org|example\.net|invalid\.invalid|mailinator\.com|guerrillamail\.com)$/i

export function isProductionIntakeHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (!host) return false
  if (LOCAL_HOST_RE.test(host)) return false
  return PRODUCTION_HOST_RE.test(host)
}

export function isFabricatedProbeEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0 || at === trimmed.length - 1) return false
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  if (PROBE_LOCAL_PART_RE.test(local)) return true
  if (PROBE_DOMAIN_RE.test(domain)) return true
  return false
}

export type ProbeGuardResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Block fabricated probe emails when the page is running on production.
 * Local/dev/preview always allow them so unit + UI tests can use fixtures.
 */
export function assertSafeIntakeEmail(
  email: string,
  hostname: string,
): ProbeGuardResult {
  if (!isFabricatedProbeEmail(email)) return { ok: true }
  if (!isProductionIntakeHost(hostname)) return { ok: true }
  return {
    ok: false,
    error:
      'Test/probe email blocked on production intake. Use local Vite /api/intake (mock, no SMTP) — never POST fabricated addresses to tgttechnologies.com.',
  }
}

export function resolveIntakePostUrl(apiEndpoint: string, origin: string): string {
  if (/^https?:\/\//i.test(apiEndpoint)) return apiEndpoint
  return new URL(apiEndpoint, origin).toString()
}

export function isProductionIntakeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'http://localhost')
    return isProductionIntakeHost(parsed.hostname)
  } catch {
    return false
  }
}
