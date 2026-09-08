import type { IncomingMessage, ServerResponse } from 'node:http'
import { isFabricatedProbeEmail } from '../src/lib/intake-probe-guard.ts'
import { validateIntakePayload } from '../src/lib/intake-validate.ts'

type JsonRecord = Record<string, unknown>

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: JsonRecord): void {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-TGT-Intake-Mode', 'local-mock-no-smtp')
  res.end(payload)
}

/**
 * Local/dev/preview intake handler.
 *
 * CRITICAL: This path must never send SMTP / Exchange / Graph mail.
 * It only validates and acknowledges. Production ChatGPT apex has a separate
 * durable store that does trigger live mailbox traffic — do not point automated
 * tests at that host.
 */
export async function handleIntakeRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Allow', 'POST, OPTIONS')
    res.setHeader('X-TGT-Intake-Mode', 'local-mock-no-smtp')
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
    return
  }

  let parsed: unknown
  try {
    const text = await readBody(req)
    parsed = text ? JSON.parse(text) : null
  } catch {
    sendJson(res, 400, { ok: false, error: 'invalid_request' })
    return
  }

  const result = validateIntakePayload(parsed)
  if (!result.ok) {
    sendJson(res, result.status, { ok: false, error: result.error })
    return
  }

  const email =
    parsed && typeof parsed === 'object' && typeof (parsed as JsonRecord).email === 'string'
      ? String((parsed as JsonRecord).email)
      : ''

  console.info('[tgt-intake]', {
    mode: 'local-mock-no-smtp',
    requestType: result.requestType,
    requestId: result.requestId,
    probeEmail: isFabricatedProbeEmail(email),
    at: new Date().toISOString(),
  })

  sendJson(res, 200, {
    ok: true,
    delivery: 'confirmed',
    requestId: result.requestId,
    smtp: 'disabled',
  })
}
