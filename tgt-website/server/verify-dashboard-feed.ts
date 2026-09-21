/**
 * Reconcile SharePoint dashboard feed checks with live Graph probes.
 * Updates only probe-proven facts. Never stamps GREEN.
 */
import {
  probeAppRuntimeRecordReadback,
  probeMailboxCoverage,
  readDashboardFeedJson,
  writeDashboardFeedJson,
  type CoverageProbe,
} from './graph-sharepoint.ts'

export const FEED_FRESHNESS_HOURS = 4

type JsonRecord = Record<string, unknown>

export type VerificationReport = {
  greenEligible: boolean
  findings: string[]
  status: string
  checks: {
    mailbox_coverage: 'PASS' | 'BLOCKED'
    app_runtime_record_readback: 'PASS' | 'BLOCKED'
  }
  probeEvidence: {
    mailbox_coverage: string
    app_runtime_record_readback: string
  }
  last_verified_at: string
  incoming_last_verified_at: string | null
  feed: JsonRecord
}

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonRecord
  return {}
}

export function isFresh(
  timestamp: string | undefined,
  maxAgeHours = FEED_FRESHNESS_HOURS,
  nowMs = Date.now(),
): boolean {
  if (!timestamp) return false
  const t = Date.parse(timestamp)
  if (!Number.isFinite(t)) return false
  return nowMs - t < maxAgeHours * 60 * 60 * 1000
}

function declaredCount(feed: JsonRecord, ui: JsonRecord, counts: JsonRecord, key: string): number {
  const candidates = [counts[key], ui[key], feed[key]]
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (Array.isArray(value)) return value.length
  }
  return 0
}

function findRev012(feed: JsonRecord): JsonRecord | null {
  const records = Array.isArray(feed.records) ? feed.records : []
  for (const row of records) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const rec = row as JsonRecord
    const id = String(rec.opportunity_id || rec.lead_id || rec.id || '')
    if (id === 'REV-012') return rec
  }
  return null
}

function setStringCheck(checks: JsonRecord, name: string, status: 'PASS' | 'BLOCKED'): void {
  const current = checks[name]
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    const obj = current as JsonRecord
    obj.status = status
    return
  }
  checks[name] = status
}

function checkAsPassOrBlocked(checks: JsonRecord, name: string): 'PASS' | 'BLOCKED' {
  const current = checks[name]
  const raw =
    current && typeof current === 'object' && !Array.isArray(current)
      ? String((current as JsonRecord).status || '')
      : String(current || '')
  return raw.toUpperCase() === 'PASS' ? 'PASS' : 'BLOCKED'
}

function probePassed(probe: CoverageProbe): boolean {
  return probe.status === 'PASS' && probe.http === 200
}

export function applyVerifiedProbeFacts(input: {
  feed: unknown
  mailbox: CoverageProbe
  readback: CoverageProbe
  now?: Date
}): VerificationReport {
  const feed = asRecord(JSON.parse(JSON.stringify(input.feed)))
  const ui = asRecord(feed.ui_sync_health)
  feed.ui_sync_health = ui
  const checks = asRecord(ui.checks)
  ui.checks = checks
  const counts = asRecord(ui.counts)
  const findings: string[] = []
  const now = input.now ?? new Date()
  const incoming =
    typeof ui.last_verified_at === 'string' && ui.last_verified_at.trim()
      ? ui.last_verified_at
      : null
  const freshEnough = isFresh(incoming || undefined, FEED_FRESHNESS_HOURS, now.getTime())

  const mailboxPass = probePassed(input.mailbox)
  const readbackPass = probePassed(input.readback)
  const mailboxEvidence = mailboxPass
    ? `Live Inbox GET returned HTTP ${input.mailbox.http}`
    : `Live Inbox GET did not PASS (HTTP ${input.mailbox.http})`
  const readbackEvidence = readbackPass
    ? `Live SharePoint read-back returned HTTP ${input.readback.http}`
    : `Live SharePoint read-back did not PASS (HTTP ${input.readback.http})`

  setStringCheck(checks, 'mailbox_coverage', mailboxPass ? 'PASS' : 'BLOCKED')
  setStringCheck(checks, 'app_runtime_record_readback', readbackPass ? 'PASS' : 'BLOCKED')
  ui.probe_evidence = {
    mailbox_coverage: mailboxEvidence,
    app_runtime_record_readback: readbackEvidence,
  }

  const invalidRoutes = declaredCount(feed, ui, counts, 'invalid_routes')
  if (invalidRoutes > 0) findings.push(`invalid_routes=${invalidRoutes}`)

  const blockedWrites = declaredCount(feed, ui, counts, 'blocked_sync_writes')
  if (blockedWrites > 0) findings.push(`blocked_sync_writes=${blockedWrites}`)

  const rev012 = findRev012(feed)
  if (String(rev012?.status || '').toUpperCase() === 'BLOCKED') {
    findings.push('REV-012 remains BLOCKED')
  }

  if (!freshEnough) findings.push('verification data older than 4 hours')

  const mailboxCheck = checkAsPassOrBlocked(checks, 'mailbox_coverage')
  const readbackCheck = checkAsPassOrBlocked(checks, 'app_runtime_record_readback')
  const allChecksPass = mailboxCheck === 'PASS' && readbackCheck === 'PASS'
  const greenEligible = allChecksPass && freshEnough && findings.length === 0

  if (!greenEligible) ui.status = 'BLOCKED'

  const lastVerifiedAt = now.toISOString()
  ui.last_verified_at = lastVerifiedAt
  ui.verification_report = {
    greenEligible,
    findings: [...findings],
    ran_at: lastVerifiedAt,
  }

  return {
    greenEligible,
    findings,
    status: String(ui.status || 'BLOCKED').toUpperCase(),
    checks: {
      mailbox_coverage: mailboxCheck,
      app_runtime_record_readback: readbackCheck,
    },
    probeEvidence: {
      mailbox_coverage: mailboxEvidence,
      app_runtime_record_readback: readbackEvidence,
    },
    last_verified_at: lastVerifiedAt,
    incoming_last_verified_at: incoming,
    feed,
  }
}

export async function verifyDashboardFeed(options: {
  write: boolean
}): Promise<VerificationReport & { wrote: boolean; writePath: string | null }> {
  const live = await readDashboardFeedJson()
  const mailbox = await probeMailboxCoverage()
  const readback = await probeAppRuntimeRecordReadback()
  const report = applyVerifiedProbeFacts({
    feed: live.feed,
    mailbox,
    readback,
    now: new Date(),
  })
  if (!options.write) {
    return { ...report, wrote: false, writePath: null }
  }
  const proof = await writeDashboardFeedJson(report.feed)
  return { ...report, wrote: true, writePath: proof.path }
}
