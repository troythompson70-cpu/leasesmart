/**
 * Sandbox PayPal Orders v2. The browser never receives the secret.
 * Live keys are refused until Troy says GO LIVE in a later change.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadGraphEnvFromDotEnv, graphFetch } from './graph-sharepoint.ts'
import { easternStamp, PIPELINE_LIST_ID, TEAM_SITE_ID } from './website-lead-copy.ts'
import { catalog } from '../src/content.ts'
import {
  alreadyFiled,
  formatUsd,
  orderOpportunityId,
  priceCart,
  webhookVerified,
  type CartRequestLine,
  type PricedLine,
} from '../src/lib/catalog.ts'

const SANDBOX_API = 'https://api-m.sandbox.paypal.com'
const OWNER_EMAIL = 'tgates@tgttechnologies.com'

type JsonRecord = Record<string, unknown>

function paypalEnv(): { clientId: string; secret: string; webhookId: string } {
  loadGraphEnvFromDotEnv()
  if (String(process.env.PAYPAL_ENV || '').trim() !== 'sandbox') {
    throw new Error('PayPal live is not enabled. Waiting for GO LIVE.')
  }
  const clientId = String(process.env.PAYPAL_CLIENT_ID || '').trim()
  const secret = String(process.env.PAYPAL_CLIENT_SECRET || '').trim()
  const webhookId = String(process.env.PAYPAL_WEBHOOK_ID || '').trim()
  if (!clientId || !secret) throw new Error('PayPal sandbox keys are not in the server environment.')
  return { clientId, secret, webhookId }
}

export function paypalPublicConfig(): { clientId: string; currency: 'USD' } {
  const { clientId } = paypalEnv()
  return { clientId, currency: 'USD' }
}

async function paypalToken(): Promise<string> {
  const { clientId, secret } = paypalEnv()
  const res = await fetch(`${SANDBOX_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string }
  if (!res.ok || !json.access_token) {
    throw new Error(`PayPal token failed (HTTP ${res.status} ${json.error || 'error'}).`)
  }
  return json.access_token
}

async function paypalJson(pathname: string, token: string, init: RequestInit = {}): Promise<{ status: number; body: JsonRecord }> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await fetch(`${SANDBOX_API}${pathname}`, { ...init, headers })
  const body = (await res.json().catch(() => ({}))) as JsonRecord
  return { status: res.status, body }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: JsonRecord): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export async function createPaypalOrder(lines: PricedLine[]): Promise<string> {
  const totalCents = lines.reduce((sum, line) => sum + line.lineCents, 0)
  const token = await paypalToken()
  const { status, body } = await paypalJson('/v2/checkout/orders', token, {
    method: 'POST',
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: formatUsd(totalCents),
          },
          description: lines.map((line) => `${line.quantity} x ${line.name}`).join(', '),
        },
      ],
    }),
  })
  const id = String(body.id || '')
  if (status !== 201 || !id) throw new Error(`PayPal create order failed (HTTP ${status}).`)
  return id
}

async function existingOpportunityIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  const res = await graphFetch(
    `/sites/${TEAM_SITE_ID}/lists/${PIPELINE_LIST_ID}/items?$expand=fields($select=opportunity_id)&$top=200`,
  )
  if (!res.ok) throw new Error(`Pipeline read failed (HTTP ${res.status}).`)
  const body = (await res.json()) as { value?: Array<{ fields?: { opportunity_id?: string } }> }
  for (const item of body.value || []) {
    const id = String(item.fields?.opportunity_id || '').trim()
    if (id) ids.add(id)
  }
  return ids
}

export async function filePaidOrder(input: {
  paypalOrderId: string
  buyerEmail: string
  buyerName: string
  lines: PricedLine[]
}): Promise<{ opportunityId: string; created: boolean }> {
  const opportunityId = orderOpportunityId(input.paypalOrderId)
  const existing = await existingOpportunityIds()
  if (alreadyFiled(existing, input.paypalOrderId)) return { opportunityId, created: false }
  const stamp = easternStamp(new Date())
  const summary = input.lines.map((line) => `${line.quantity} x ${line.name}`).join(', ')
  const res = await graphFetch(`/sites/${TEAM_SITE_ID}/lists/${PIPELINE_LIST_ID}/items`, {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        Title: opportunityId,
        opportunity_id: opportunityId,
        company: input.buyerName || input.buyerEmail || 'Website order',
        buyer_or_contact: input.buyerEmail || input.buyerName || 'Website buyer',
        contact_route: 'Website order',
        lane: 'Website Order',
        priority: 'Tier 2',
        status: 'NEW',
        need: summary,
        source_date: stamp.date,
        source_reference: input.paypalOrderId,
        incoming_attention: true,
        last_updated: stamp.timestamp,
      },
    }),
  })
  if (!res.ok) throw new Error(`Pipeline order create failed (HTTP ${res.status}).`)
  return { opportunityId, created: true }
}

export async function sendOrderEmails(input: {
  paypalOrderId: string
  buyerEmail: string
  lines: PricedLine[]
}): Promise<void> {
  const total = formatUsd(input.lines.reduce((sum, line) => sum + line.lineCents, 0))
  const summary = input.lines.map((line) => `${line.quantity} x ${line.name}`).join(', ')
  const text = `TGT received your sandbox order ${input.paypalOrderId} for $${total}: ${summary}.`
  const recipients = [OWNER_EMAIL]
  if (input.buyerEmail && input.buyerEmail.toLowerCase() !== OWNER_EMAIL) recipients.unshift(input.buyerEmail)
  const res = await graphFetch('/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject: `TGT order ${orderOpportunityId(input.paypalOrderId)}`,
        body: { contentType: 'Text', content: text },
        toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: true,
    }),
  })
  if (res.status !== 202 && !res.ok) {
    throw new Error(`Order email failed (HTTP ${res.status}).`)
  }
}

function payerFromCapture(body: JsonRecord): { email: string; name: string } {
  const payer = (body.payer || {}) as { email_address?: string; name?: { given_name?: string; surname?: string } }
  const name = [payer.name?.given_name, payer.name?.surname].filter(Boolean).join(' ')
  return { email: String(payer.email_address || ''), name }
}

export async function capturePaypalOrder(orderId: string, lines: PricedLine[]): Promise<{
  orderId: string
  opportunityId: string
  status: string
}> {
  const token = await paypalToken()
  const { status, body } = await paypalJson(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, token, {
    method: 'POST',
  })
  const orderStatus = String(body.status || '')
  if (status !== 201 || orderStatus !== 'COMPLETED') {
    throw new Error(`PayPal capture failed (HTTP ${status} ${orderStatus || 'error'}).`)
  }
  const purchase = (Array.isArray(body.purchase_units) ? body.purchase_units[0] : {}) as {
    amount?: { value?: string }
    payments?: { captures?: Array<{ amount?: { value?: string } }> }
  }
  const captured = purchase.payments?.captures?.[0]?.amount?.value || purchase.amount?.value
  const expected = formatUsd(lines.reduce((sum, line) => sum + line.lineCents, 0))
  if (captured !== expected) {
    throw new Error('Captured amount does not match the catalog.')
  }
  const payer = payerFromCapture(body)
  const filed = await filePaidOrder({
    paypalOrderId: orderId,
    buyerEmail: payer.email,
    buyerName: payer.name,
    lines,
  })
  await sendOrderEmails({ paypalOrderId: orderId, buyerEmail: payer.email, lines }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`[paypal] email failed: ${message}`)
  })
  return { orderId, opportunityId: filed.opportunityId, status: orderStatus }
}

export async function verifyWebhook(req: IncomingMessage, event: JsonRecord): Promise<boolean> {
  const { webhookId } = paypalEnv()
  if (!webhookId) return false
  const token = await paypalToken()
  const { status, body } = await paypalJson('/v1/notifications/verify-webhook-signature', token, {
    method: 'POST',
    body: JSON.stringify({
      auth_algo: req.headers['paypal-auth-algo'],
      cert_url: req.headers['paypal-cert-url'],
      transmission_id: req.headers['paypal-transmission-id'],
      transmission_sig: req.headers['paypal-transmission-sig'],
      transmission_time: req.headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: event,
    }),
  })
  if (status !== 200) return false
  return webhookVerified(String(body.verification_status || ''))
}

export async function handlePaypalRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', 'http://127.0.0.1:5173')
  const path = url.pathname.replace(/^\/api\/paypal/, '') || '/'
  try {
    if (req.method === 'GET' && path === '/config') {
      sendJson(res, 200, paypalPublicConfig())
      return
    }
    if (req.method === 'POST' && path === '/orders') {
      const parsed = JSON.parse(await readBody(req)) as { items?: CartRequestLine[] }
      const priced = priceCart(parsed.items || [], catalog)
      if (!priced.ok) {
        sendJson(res, 400, { error: priced.error })
        return
      }
      const orderId = await createPaypalOrder(priced.lines)
      sendJson(res, 201, { orderId })
      return
    }
    if (req.method === 'POST' && path === '/capture') {
      const parsed = JSON.parse(await readBody(req)) as { orderId?: string; items?: CartRequestLine[] }
      const orderId = String(parsed.orderId || '').trim()
      const priced = priceCart(parsed.items || [], catalog)
      if (!orderId || !priced.ok) {
        sendJson(res, 400, { error: priced.ok ? 'Missing order id.' : priced.error })
        return
      }
      sendJson(res, 200, await capturePaypalOrder(orderId, priced.lines))
      return
    }
    if (req.method === 'POST' && path === '/webhook') {
      const event = JSON.parse(await readBody(req)) as JsonRecord
      const verified = await verifyWebhook(req, event)
      if (!verified) {
        sendJson(res, 400, { error: 'Webhook signature was not verified.' })
        return
      }
      if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const resource = (event.resource || {}) as {
          supplementary_data?: { related_ids?: { order_id?: string } }
          amount?: { value?: string }
        }
        const orderId = String(resource.supplementary_data?.related_ids?.order_id || '')
        if (orderId && resource.amount?.value) {
          const unit = 28000
          const cents = Math.round(Number(resource.amount.value) * 100)
          const quantity = cents / unit
          const priced = priceCart([{ sku: 'ai-laptop-280', quantity }], catalog)
          if (priced.ok && formatUsd(priced.totalCents) === resource.amount.value) {
            await filePaidOrder({
              paypalOrderId: orderId,
              buyerEmail: '',
              buyerName: 'PayPal webhook',
              lines: priced.lines,
            })
          }
        }
      }
      sendJson(res, 200, { ok: true })
      return
    }
    sendJson(res, 404, { error: 'Not found.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    sendJson(res, 503, { error: message })
  }
}
