/**
 * Production /api/dashboard-feed for Netlify (or Netlify-compatible hosts).
 * Fail-closed when Graph env is missing. Never marks VERIFIED.
 * Types are structural (no @netlify/functions runtime dep required in this package).
 */
import {
  graphAuthReady,
  missingGraphEnv,
  readDashboardFeedJson,
} from '../../server/graph-sharepoint.ts'

type JsonRecord = Record<string, unknown>

const CLOSED_STATUSES = new Set(['WON', 'LOST', 'PASS', 'DONE'])

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonRecord
  return {}
}

function activityMs(row: JsonRecord): number {
  const keys = [
    'latest_transmission_at',
    'last_activity_at',
    'new_activity_at',
    'updated_at',
    'last_updated',
    'last_verified_at',
    'created_at',
    'source_date',
  ]
  let best = 0
  for (const key of keys) {
    const t = Date.parse(String(row[key] || ''))
    if (Number.isFinite(t) && t > best) best = t
  }
  return best
}

function newestFirst(rows: unknown[]): unknown[] {
  return [...rows].sort((a, b) => {
    const left = asRecord(a)
    const right = asRecord(b)
    const leftClosed = CLOSED_STATUSES.has(String(left.status || '').toUpperCase())
    const rightClosed = CLOSED_STATUSES.has(String(right.status || '').toUpperCase())
    if (leftClosed !== rightClosed) return leftClosed ? 1 : -1
    return activityMs(right) - activityMs(left)
  })
}

function withNewestFirst(feed: JsonRecord): JsonRecord {
  const next = { ...feed }
  if (Array.isArray(next.opportunities)) next.opportunities = newestFirst(next.opportunities)
  if (Array.isArray(next.records)) next.records = newestFirst(next.records)
  return next
}

function json(status: number, body: JsonRecord): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'GET, OPTIONS',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    })
  }

  if (req.method !== 'GET') {
    return json(405, { ok: false, error: 'method_not_allowed' })
  }

  if (!graphAuthReady()) {
    return json(503, {
      ok: false,
      verificationState: 'NOT_VERIFIED',
      error: 'Live SharePoint 10 Dashboard Feed is not connected: Graph env vars are missing.',
      missingEnv: missingGraphEnv(),
    })
  }

  try {
    const live = await readDashboardFeedJson()
    if (!live.feed || typeof live.feed !== 'object') {
      return json(503, {
        ok: false,
        verificationState: 'NOT_VERIFIED',
        error: 'SharePoint 10 Dashboard Feed is not a JSON object.',
      })
    }
    return json(200, withNewestFirst(live.feed as JsonRecord))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json(503, {
      ok: false,
      verificationState: 'NOT_VERIFIED',
      error: message,
    })
  }
}

export const config = {
  path: '/api/dashboard-feed',
  method: ['GET', 'OPTIONS'],
}
