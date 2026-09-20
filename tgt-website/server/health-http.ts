/**
 * Local JSON /api/health. Never SPA HTML. Never invents GREEN.
 * Combines SharePoint feed ui_sync_health with live Graph probes.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  graphAuthReady,
  missingGraphEnv,
  probeAppRuntimeRecordReadback,
  probeMailboxCoverage,
  readDashboardFeedJson,
  type CoverageProbe,
} from './graph-sharepoint.ts'

type JsonRecord = Record<string, unknown>
type HealthStatus = 'GREEN' | 'YELLOW' | 'BLOCKED' | 'RED'

function allowLocalOrigin(req: IncomingMessage): string {
  const origin = String(req.headers.origin || '')
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) return origin
  return 'http://127.0.0.1:5173'
}

function sendJson(res: ServerResponse, req: IncomingMessage, status: number, body: JsonRecord): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', allowLocalOrigin(req))
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.end(JSON.stringify(body))
}

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonRecord
  return {}
}

function feedDeclaredStatus(feed: JsonRecord): HealthStatus {
  const ui = asRecord(feed.ui_sync_health)
  const raw = String(ui.status || ui.health_state || '').toUpperCase()
  switch (raw) {
    case 'GREEN':
    case 'YELLOW':
    case 'RED':
    case 'BLOCKED':
      return raw
    default:
      return 'BLOCKED'
  }
}

function combinedStatus(feedStatus: HealthStatus, probes: CoverageProbe[]): HealthStatus {
  const mailbox = probes.find((p) => p.check === 'mailbox_coverage')
  const appRead = probes.find((p) => p.check === 'app_runtime_record_readback')
  if (
    feedStatus === 'GREEN' &&
    mailbox?.status === 'PASS' &&
    appRead?.status === 'PASS'
  ) {
    return 'GREEN'
  }
  if (feedStatus === 'RED') return 'RED'
  if (feedStatus === 'BLOCKED' || mailbox?.status === 'BLOCKED' || appRead?.status === 'BLOCKED') {
    return 'BLOCKED'
  }
  return 'YELLOW'
}

export async function handleHealthRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Allow', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Origin', allowLocalOrigin(req))
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.end()
    return
  }

  if (req.method !== 'GET') {
    sendJson(res, req, 405, { ok: false, error: 'method_not_allowed' })
    return
  }

  if (!graphAuthReady()) {
    sendJson(res, req, 503, {
      ok: false,
      verificationState: 'NOT_VERIFIED',
      error: 'MISSING_GRAPH_SECRETS',
      missingEnv: missingGraphEnv(),
      ui_sync_health: { status: 'BLOCKED' },
    })
    return
  }

  try {
    const live = await readDashboardFeedJson()
    const feed = asRecord(live.feed)
    const declaredUi = asRecord(feed.ui_sync_health)
    const declaredChecks = asRecord(declaredUi.checks)
    const probes = await Promise.all([probeMailboxCoverage(), probeAppRuntimeRecordReadback()])
    const feedStatus = feedDeclaredStatus(feed)
    const status = combinedStatus(feedStatus, probes)
    const probeMap = Object.fromEntries(probes.map((p) => [p.check, p.status])) as Record<
      string,
      CoverageProbe['status']
    >

    sendJson(res, req, 200, {
      ok: true,
      verificationState: status === 'GREEN' ? 'PENDING_AUDITOR' : 'NOT_VERIFIED',
      ui_sync_health: {
        status,
        label: declaredUi.label || 'SYNC HEALTH',
        source: 'live Graph probes + SharePoint 10 Dashboard Feed',
        last_verified_at: declaredUi.last_verified_at || null,
        feed_declared_status: feedStatus,
        checks: {
          ...declaredChecks,
          mailbox_coverage: probeMap.mailbox_coverage,
          app_runtime_record_readback: probeMap.app_runtime_record_readback,
        },
        probes,
        counts: declaredUi.counts || null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    sendJson(res, req, 503, {
      ok: false,
      verificationState: 'NOT_VERIFIED',
      error: message,
      ui_sync_health: { status: 'BLOCKED' },
    })
  }
}
