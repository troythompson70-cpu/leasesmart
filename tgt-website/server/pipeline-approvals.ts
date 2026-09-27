/**
 * Owner approvals for TGT Pipeline, run by the local helper.
 * Troy replies APPROVE or REJECT. A phone cannot open 127.0.0.1, so the email has no link.
 * Does not email customers and does not mark VERIFIED.
 */
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { beginCycle, endCycle } from './helper-heartbeat.ts'
import { graphFetch } from './graph-sharepoint.ts'
import { replaceInterval } from './process-loops.ts'
import { easternStamp, PIPELINE_LIST_ID, TEAM_SITE_ID } from './website-lead-copy.ts'

export const APPROVAL_RECIPIENT = 'tgates@tgttechnologies.com'
export const APPROVAL_INTERVAL_MS = 15 * 60 * 1000
export const LOCAL_APPROVAL_ORIGIN = 'http://127.0.0.1:5173'

export type ApprovalDecision = 'APPROVE' | 'REJECT'

export type ApprovalRow = {
  id: string
  opportunityId: string
  company: string
  nextAction: string
  ownerApprovalRequired: string
}

export type TokenRecord = {
  itemId: string
  opportunityId: string
  used: boolean
}

export type ApprovalStore = {
  sentItemIds: string[]
  tokens: Record<string, TokenRecord>
  appliedReplyIds: string[]
}

type GraphListPayload = {
  value?: Array<{ id?: string; fields?: Record<string, unknown> }>
  '@odata.nextLink'?: string
  error?: { code?: string }
}

const STORE_DIR = path.join(homedir(), '.tgt-pipeline-approvals')
const STORE_PATH = path.join(STORE_DIR, 'store.json')

function text(value: unknown): string {
  return String(value ?? '').trim()
}

export function emptyStore(): ApprovalStore {
  return { sentItemIds: [], tokens: {}, appliedReplyIds: [] }
}

export function loadApprovalStore(filePath = STORE_PATH): ApprovalStore {
  if (!existsSync(filePath)) return emptyStore()
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<ApprovalStore>
    return {
      sentItemIds: Array.isArray(parsed.sentItemIds) ? parsed.sentItemIds.map((id) => text(id)).filter(Boolean) : [],
      tokens: parsed.tokens && typeof parsed.tokens === 'object' ? parsed.tokens : {},
      appliedReplyIds: Array.isArray(parsed.appliedReplyIds)
        ? parsed.appliedReplyIds.map((id) => text(id)).filter(Boolean)
        : [],
    }
  } catch {
    return emptyStore()
  }
}

export function saveApprovalStore(store: ApprovalStore, filePath = STORE_PATH): void {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(store)}\n`, { mode: 0o600 })
}

/** Rows flagged Yes that have not already been emailed. */
export function rowsNeedingApproval(rows: ApprovalRow[], sentItemIds: Iterable<string>): ApprovalRow[] {
  const sent = new Set(Array.from(sentItemIds, (id) => text(id)).filter(Boolean))
  const chosen: ApprovalRow[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (row.ownerApprovalRequired !== 'Yes') continue
    if (!row.id || sent.has(row.id) || seen.has(row.id)) continue
    seen.add(row.id)
    chosen.push(row)
  }
  return chosen
}

export function issueToken(store: ApprovalStore, row: ApprovalRow): string {
  const token = randomBytes(32).toString('hex')
  store.tokens[token] = { itemId: row.id, opportunityId: row.opportunityId, used: false }
  return token
}

/** Returns the record once. A second use of the same token returns null. */
export function consumeToken(store: ApprovalStore, token: string): TokenRecord | null {
  const record = store.tokens[text(token)]
  if (!record || record.used) return null
  record.used = true
  return record
}

export function decisionFromReply(body: string): ApprovalDecision | null {
  const beforeQuote = body.split(/\r?\n(?:On .+ wrote:|-----Original Message-----|From: )/)[0] || body
  const fresh = beforeQuote
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('>'))
    .join('\n')
  const approve = /\bAPPROVE\b/.test(fresh.toUpperCase())
  const reject = /\bREJECT\b/.test(fresh.toUpperCase())
  if (approve === reject) return null
  if (approve) return 'APPROVE'
  return 'REJECT'
}

export function parseDecision(value: string): ApprovalDecision | null {
  if (value === 'APPROVE' || value === 'REJECT') return value
  return null
}

export function approvalWriteBack(decision: ApprovalDecision, now = new Date()): {
  status: 'APPROVED' | 'PASS'
  next_action: string
  owner_approval_required: 'No'
  last_updated: string
} {
  const stamp = easternStamp(now).timestamp
  switch (decision) {
    case 'APPROVE':
      return {
        status: 'APPROVED',
        next_action: 'Approved by owner',
        owner_approval_required: 'No',
        last_updated: stamp,
      }
    case 'REJECT':
      return {
        status: 'PASS',
        next_action: 'Rejected by owner',
        owner_approval_required: 'No',
        last_updated: stamp,
      }
    default: {
      const exhaustive: never = decision
      return exhaustive
    }
  }
}

export function approvalLinks(token: string, origin = LOCAL_APPROVAL_ORIGIN): { approve: string; reject: string } {
  const base = `${origin}/api/pipeline-approval?token=${encodeURIComponent(token)}&decision=`
  return { approve: `${base}APPROVE`, reject: `${base}REJECT` }
}

export function approvalMessage(row: ApprovalRow, _token: string): { subject: string; body: string } {
  const subject = `TGT approval ${row.opportunityId} ${row.company}`.trim()
  const body = [
    'Owner approval is required.',
    '',
    `Opportunity: ${row.opportunityId}`,
    `Company: ${row.company}`,
    `Next action: ${row.nextAction || 'None'}`,
    '',
    'Reply to this email with the single word APPROVE or the single word REJECT.',
  ].join('\n')
  return { subject, body }
}

function graphPathFromNext(nextLink: string): string {
  const marker = '/v1.0'
  const at = nextLink.indexOf(marker)
  if (at === -1) throw new Error('Graph next link is not a v1.0 URL.')
  return nextLink.slice(at + marker.length)
}

export async function readApprovalRows(): Promise<ApprovalRow[]> {
  const rows: ApprovalRow[] = []
  let next: string | null = `/sites/${TEAM_SITE_ID}/lists/${PIPELINE_LIST_ID}/items?$expand=fields&$top=200`
  while (next) {
    const res = await graphFetch(next)
    const body = (await res.json().catch(() => ({}))) as GraphListPayload
    if (!res.ok) {
      const code = body.error?.code || 'graph_error'
      throw new Error(`Pipeline approval read failed (HTTP ${res.status} ${code}).`)
    }
    for (const item of body.value || []) {
      const fields = item.fields || {}
      const id = text(item.id || fields.id)
      if (!id) continue
      rows.push({
        id,
        opportunityId: text(fields.opportunity_id),
        company: text(fields.company),
        nextAction: text(fields.next_action),
        ownerApprovalRequired: text(fields.owner_approval_required),
      })
    }
    next = body['@odata.nextLink'] ? graphPathFromNext(body['@odata.nextLink']) : null
  }
  return rows
}

export async function sendApprovalEmail(row: ApprovalRow, token: string): Promise<void> {
  const message = approvalMessage(row, token)
  const res = await graphFetch('/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject: message.subject,
        body: { contentType: 'Text', content: message.body },
        toRecipients: [{ emailAddress: { address: APPROVAL_RECIPIENT } }],
      },
      saveToSentItems: true,
    }),
  })
  if (res.status === 202 || res.ok) return
  const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } }
  const code = body.error?.code || 'graph_error'
  throw new Error(`Approval email failed (HTTP ${res.status} ${code}).`)
}

export async function writeApprovalResult(itemId: string, decision: ApprovalDecision): Promise<void> {
  const fields = approvalWriteBack(decision)
  const res = await graphFetch(`/sites/${TEAM_SITE_ID}/lists/${PIPELINE_LIST_ID}/items/${itemId}/fields`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } }
    const code = body.error?.code || 'graph_error'
    throw new Error(`Approval write-back failed (HTTP ${res.status} ${code}).`)
  }
}

export async function sendPendingApprovals(
  log: (line: string) => void = console.log,
  onlyItemId?: string,
): Promise<string[]> {
  const store = loadApprovalStore()
  const rows = rowsNeedingApproval(await readApprovalRows(), store.sentItemIds).filter((row) =>
    onlyItemId ? row.id === onlyItemId : true,
  )
  const sent: string[] = []
  for (const row of rows) {
    const token = issueToken(store, row)
    try {
      await sendApprovalEmail(row, token)
    } catch (err) {
      delete store.tokens[token]
      saveApprovalStore(store)
      throw err
    }
    store.sentItemIds.push(row.id)
    saveApprovalStore(store)
    sent.push(row.id)
    log(`[pipeline-approval] sent item ${row.id} ${row.opportunityId}`)
  }
  return sent
}

export async function applyApprovalToken(
  token: string,
  decision: ApprovalDecision,
  log: (line: string) => void = console.log,
): Promise<'applied' | 'used' | 'unknown'> {
  const store = loadApprovalStore()
  const record = store.tokens[text(token)]
  if (!record) return 'unknown'
  if (record.used) return 'used'
  await writeApprovalResult(record.itemId, decision)
  record.used = true
  saveApprovalStore(store)
  log(`[pipeline-approval] ${decision} item ${record.itemId} ${record.opportunityId}`)
  return 'applied'
}

function requestUrl(req: IncomingMessage): URL {
  return new URL(req.url || '/', LOCAL_APPROVAL_ORIGIN)
}

export async function handlePipelineApprovalRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  const url = requestUrl(req)
  const decision = parseDecision(url.searchParams.get('decision') || '')
  const token = url.searchParams.get('token') || ''
  if (!decision || !token) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Missing token or decision.')
    return
  }
  const result = await applyApprovalToken(token, decision)
  res.statusCode = result === 'applied' ? 200 : 409
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  if (result === 'applied') res.end(decision === 'APPROVE' ? 'Approved.' : 'Rejected.')
  else if (result === 'used') res.end('This link was already used.')
  else res.end('This link is not valid.')
}

type ReplyMessage = { id?: string; subject?: string; bodyPreview?: string; isDraft?: boolean }

/** Reads a reply of APPROVE or REJECT. Mail.Read is required. The original approval email is ignored. */
export async function applyApprovalReplies(log: (line: string) => void = console.log): Promise<void> {
  const res = await graphFetch(
    '/me/messages?$top=20&$select=id,subject,bodyPreview,isDraft&$orderby=receivedDateTime desc',
  )
  if (!res.ok) {
    log(`[pipeline-approval] reply check skipped: HTTP ${res.status}`)
    return
  }
  const body = (await res.json().catch(() => ({}))) as { value?: ReplyMessage[] }
  const store = loadApprovalStore()
  for (const message of body.value || []) {
    const id = text(message.id)
    const subject = text(message.subject)
    if (!id || message.isDraft || store.appliedReplyIds.includes(id)) continue
    if (!/^re:/i.test(subject)) continue
    const decision = decisionFromReply(`${subject}\n${message.bodyPreview || ''}`)
    if (!decision) continue
    const record = Object.values(store.tokens).find(
      (token) => !token.used && subject.includes(token.opportunityId),
    )
    if (!record) continue
    await writeApprovalResult(record.itemId, decision)
    record.used = true
    store.appliedReplyIds.push(id)
    log(`[pipeline-approval] reply ${decision} item ${record.itemId} ${record.opportunityId}`)
  }
  saveApprovalStore(store)
}

/** Runs once immediately, then every 15 minutes. A Vite restart replaces the previous timer. */
export function startPipelineApprovalLoop(log: (line: string) => void = console.log): void {
  log('[pipeline-approval] started')
  replaceInterval(
    'pipeline-approval',
    () => {
      beginCycle('pipeline-approval')
      void sendPendingApprovals(log)
        .then(() => applyApprovalReplies(log))
        .then(() => endCycle('pipeline-approval'))
        .catch((err: unknown) => {
          endCycle('pipeline-approval')
          const message = err instanceof Error ? err.message : String(err)
          log(`[pipeline-approval] tick failed: ${message}`)
        })
    },
    APPROVAL_INTERVAL_MS,
  )
}
