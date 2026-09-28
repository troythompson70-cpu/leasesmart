/**
 * Live Command Center decision write → SharePoint → immediate readback.
 * Fail-closed when Graph auth is missing. Never invents GREEN.
 * Not for fabricated production mail probes.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  graphAuthReady,
  missingGraphEnv,
  readDashboardFeedJson,
  writeDashboardFeedJson,
} from './graph-sharepoint.ts'

type JsonRecord = Record<string, unknown>

const DECISIONS = new Set([
  'keep_active',
  'pass_not_fit',
  'save_record',
  'remove_from_queue',
  'clear_incoming',
  'patch',
])

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.end(JSON.stringify(body))
}

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonRecord
  return {}
}

function opportunityList(feed: JsonRecord): { key: 'opportunities' | 'records'; list: JsonRecord[] } {
  if (Array.isArray(feed.opportunities)) {
    return { key: 'opportunities', list: feed.opportunities.map((row) => asRecord(row)) }
  }
  if (Array.isArray(feed.records)) {
    return { key: 'records', list: feed.records.map((row) => asRecord(row)) }
  }
  return { key: 'opportunities', list: [] }
}

function matchId(row: JsonRecord, id: string): boolean {
  const candidates = [row.id, row.opportunity_id, row.lead_id, row.record_id]
  return candidates.some((v) => String(v || '') === id)
}

function applyDecision(opp: JsonRecord, decision: string, patch: JsonRecord, actor: string): JsonRecord {
  const at = new Date().toISOString()
  const auditPrev = Array.isArray(opp.decision_audit) ? [...opp.decision_audit] : []
  const base = {
    ...opp,
    last_activity_at: at,
    last_write_at: at,
    decision_audit: [
      ...auditPrev,
      { at, actor, decision, note: String(patch.note || '').slice(0, 500) },
    ],
  }

  switch (decision) {
    case 'keep_active':
      return {
        ...base,
        queue_state: 'active',
        removed_from_queue: false,
        archived: false,
        last_action: 'Keep Active',
        status:
          String(opp.status || '').toUpperCase() === 'ARCHIVED' ||
          String(opp.status || '').toUpperCase() === 'REMOVED_FROM_QUEUE'
            ? 'OWNER_ACTION'
            : opp.status,
      }
    case 'pass_not_fit':
      return {
        ...base,
        status: 'PASS',
        queue_state: 'active',
        removed_from_queue: false,
        next_action: 'Passed — not a fit',
        last_action: 'Pass / Not a Fit',
      }
    case 'save_record':
      return {
        ...base,
        record_saved_at: at,
        last_action: 'Save Record',
        ...patch,
      }
    case 'remove_from_queue':
      return {
        ...base,
        status: 'ARCHIVED',
        queue_state: 'removed_from_queue',
        removed_from_queue: true,
        archived: true,
        removed_from_queue_at: at,
        last_action: 'Delete / Remove from Queue (soft)',
        source: opp.source,
        source_ref: opp.source_ref,
        source_evidence: opp.source_evidence,
        most_recent_email: opp.most_recent_email,
        message_preview: opp.message_preview,
        notes: opp.notes,
      }
    case 'clear_incoming':
      return {
        ...base,
        incoming_attention: false,
        new_activity: false,
        acknowledgement_state: 'ACKNOWLEDGED',
        acknowledged_at: at,
        status: opp.status,
        notes: opp.notes,
        latest_transmission_at: opp.latest_transmission_at,
        message_preview: opp.message_preview,
        last_action: 'Clear Incoming',
      }
    case 'patch':
      return { ...base, ...patch, status: patch.status ?? opp.status }
    default:
      throw new Error(`Unsupported decision: ${decision}`)
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function fieldsMatch(expected: JsonRecord, actual: JsonRecord, keys: string[]): string[] {
  const failures: string[] = []
  for (const key of keys) {
    if (!(key in expected)) continue
    if (String(actual[key] ?? '') !== String(expected[key] ?? '')) {
      failures.push(key)
    }
  }
  return failures
}

/**
 * POST { opportunityId, decision, patch?, actor? }
 * → read live feed → mutate → write SharePoint → readback → verify.
 */
export async function handleOpportunityDecisionRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Allow', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Origin', allowLocalOrigin(req))
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, req, 405, { ok: false, error: 'method_not_allowed' })
    return
  }

  if (!graphAuthReady()) {
    sendJson(res, req, 503, {
      ok: false,
      status: 'APPROVAL_GATE_AUTHENTICATION',
      verificationState: 'NOT_VERIFIED',
      error:
        'SharePoint decision write blocked: Graph env missing. Owner must complete graph:login or set GRAPH_* secrets.',
      missingEnv: missingGraphEnv(),
      approval_required: true,
      gate_kind: 'AUTHENTICATION',
    })
    return
  }

  let body: JsonRecord
  try {
    body = asRecord(JSON.parse(await readBody(req)))
  } catch {
    sendJson(res, req, 400, { ok: false, error: 'invalid_json' })
    return
  }

  const opportunityId = String(body.opportunityId || body.opportunity_id || '').trim()
  const decision = String(body.decision || '').trim()
  const actor = String(body.actor || 'Troy').trim() || 'Troy'
  const patch = asRecord(body.patch)

  if (!opportunityId || !DECISIONS.has(decision)) {
    sendJson(res, req, 400, {
      ok: false,
      error: 'opportunityId and a supported decision are required',
      decisions: [...DECISIONS],
    })
    return
  }

  try {
    const live = await readDashboardFeedJson()
    const feed = asRecord(live.feed)
    const { key, list } = opportunityList(feed)
    const idx = list.findIndex((row) => matchId(row, opportunityId))
    if (idx < 0) {
      sendJson(res, req, 404, {
        ok: false,
        status: 'WRITE_FAILED',
        error: `Opportunity ${opportunityId} not found in live SharePoint feed`,
      })
      return
    }

    const written = applyDecision(list[idx], decision, patch, actor)
    const nextList = [...list]
    nextList[idx] = written
    const nextFeed: JsonRecord = {
      ...feed,
      [key]: nextList,
      feed_updated_at: new Date().toISOString(),
    }

    const proof = await writeDashboardFeedJson(nextFeed)
    const readbackLive = await readDashboardFeedJson()
    const readFeed = asRecord(readbackLive.feed)
    const readList = opportunityList(readFeed).list
    const readOpp = readList.find((row) => matchId(row, opportunityId))
    if (!readOpp) {
      sendJson(res, req, 409, {
        ok: false,
        status: 'VERIFICATION_FAILED',
        message: 'SAVED — VERIFICATION FAILED',
        error: 'Write succeeded but opportunity missing on immediate readback',
        writeProof: proof,
      })
      return
    }

    const checkKeys =
      decision === 'clear_incoming'
        ? ['incoming_attention', 'status', 'notes', 'message_preview']
        : decision === 'pass_not_fit'
          ? ['status', 'next_action']
          : decision === 'remove_from_queue'
            ? ['status', 'queue_state', 'removed_from_queue']
            : decision === 'keep_active'
              ? ['queue_state', 'removed_from_queue']
              : ['last_action']

    const mismatched = fieldsMatch(written, readOpp, checkKeys)
    if (mismatched.length) {
      sendJson(res, req, 409, {
        ok: false,
        status: 'VERIFICATION_FAILED',
        message: 'SAVED — VERIFICATION FAILED',
        error: `Readback mismatch on: ${mismatched.join(', ')}`,
        writeProof: proof,
        written,
        readback: readOpp,
      })
      return
    }

    sendJson(res, req, 200, {
      ok: true,
      status: 'SAVED_VERIFIED',
      message: 'SAVED + VERIFIED',
      verificationState: 'READBACK_OK',
      writeProof: proof,
      feed: readFeed,
      written,
      readback: readOpp,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const authGate = /auth|unauthorized|AADSTS|consent|token/i.test(message)
    sendJson(res, req, 503, {
      ok: false,
      status: authGate ? 'APPROVAL_GATE_AUTHENTICATION' : 'WRITE_FAILED',
      verificationState: 'NOT_VERIFIED',
      error: message,
      approval_required: authGate,
      gate_kind: authGate ? 'AUTHENTICATION' : null,
    })
  }
}
