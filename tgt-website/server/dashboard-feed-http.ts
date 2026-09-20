import type { IncomingMessage, ServerResponse } from 'node:http'
import { graphAuthReady, missingGraphEnv, readDashboardFeedJson } from './graph-sharepoint.ts'

type JsonRecord = Record<string, unknown>

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

/**
 * Local-only live 10 Dashboard Feed proxy. Never marks VERIFIED.
 * Not for the public tgttechnologies.com apex.
 */
export async function handleDashboardFeedRequest(
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
      error: 'Live SharePoint 10 Dashboard Feed is not connected: Graph env vars are missing.',
      missingEnv: missingGraphEnv(),
    })
    return
  }

  try {
    const live = await readDashboardFeedJson()
    if (!live.feed || typeof live.feed !== 'object') {
      sendJson(res, req, 503, {
        ok: false,
        verificationState: 'NOT_VERIFIED',
        error: 'SharePoint 10 Dashboard Feed is not a JSON object.',
      })
      return
    }
    sendJson(res, req, 200, live.feed as JsonRecord)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    sendJson(res, req, 503, {
      ok: false,
      verificationState: 'NOT_VERIFIED',
      error: message,
    })
  }
}
