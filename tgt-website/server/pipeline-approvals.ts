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
  conversationId?: string
  sentAt?: string
}

export type ApprovalStore = {
  sentItemIds: string[]
  tokens: Record<string, TokenRecord>
  appliedReplyIds: string[]
}

export type ReplyMessage = {
  id?: string
  subject?: string
  bodyPreview?: string
  isDraft?: boolean
  conversationId?: string
  receivedDateTime?: string
  from?: { emailAddress?: { address?: string } }
  sender?: { emailAddress?: { address?: string } }
}

export type SentApprovalMessage = {
  subject?: string
  conversationId?: string
  sentDateTime?: string
}

export type ReplySelection =
  | { action: 'ignore-sender'; address: string }
  | { action: 'skip' }
  | { action: 'apply'; record: TokenRecord; decision: ApprovalDecision }

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

function tokenRecord(value: unknown): TokenRecord | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<TokenRecord>
  const itemId = text(record.itemId)
  if (!itemId) return null
  const next: TokenRecord = {
    itemId,
    opportunityId: text(record.opportunityId),
    used: record.used === true,
  }
  const conversationId = text(record.conversationId)
  const sentAt = text(record.sentAt)
  if (conversationId) next.conversationId = conversationId
  if (sentAt) next.sentAt = sentAt
  return next
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
      tokens: tokenMap(parsed.tokens),
      appliedReplyIds: Array.isArray(parsed.appliedReplyIds)
        ? parsed.appliedReplyIds.map((id) => text(id)).filter(Boolean)
        : [],
    }
  } catch {
    return emptyStore()
  }
}

function tokenMap(value: unknown): Record<string, TokenRecord> {
  if (!value || typeof value !== 'object') return {}
  const tokens: Record<string, TokenRecord> = {}
  for (const [key, record] of Object.entries(value)) {
    const parsed = tokenRecord(record)
    if (parsed) tokens[key] = parsed
  }
  return tokens
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

export async function sendApprovalEmail(
  row: ApprovalRow,
  token: string,
): Promise<{ conversationId: string; sentAt: string }> {
  const message = approvalMessage(row, token)
  const created = await graphFetch('/me/messages', {
    method: 'POST',
    body: JSON.stringify({
      subject: message.subject,
      body: { contentType: 'Text', content: message.body },
      toRecipients: [{ emailAddress: { address: APPROVAL_RECIPIENT } }],
    }),
  })
  const createdBody = (await created.json().catch(() => ({}))) as {
    id?: string
    conversationId?: string
    error?: { code?: string }
  }
  const draftId = text(createdBody.id)
  const conversationId = text(createdBody.conversationId)
  if (!created.ok || !draftId || !conversationId) {
    const code = createdBody.error?.code || 'graph_error'
    throw new Error(`Approval email failed (HTTP ${created.status} ${code}).`)
  }
  const sent = await graphFetch(`/me/messages/${encodeURIComponent(draftId)}/send`, { method: 'POST' })
  if (sent.status === 202 || sent.ok) {
    return { conversationId, sentAt: new Date().toISOString() }
  }
  await graphFetch(`/me/messages/${encodeURIComponent(draftId)}`, { method: 'DELETE' }).catch(() => undefined)
  const sentBody = (await sent.json().catch(() => ({}))) as { error?: { code?: string } }
  const code = sentBody.error?.code || 'graph_error'
  throw new Error(`Approval email failed (HTTP ${sent.status} ${code}).`)
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
      const sentMail = await sendApprovalEmail(row, token)
      const record = store.tokens[token]
      if (record) {
        record.conversationId = sentMail.conversationId
        record.sentAt = sentMail.sentAt
      }
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

export function replySenderAddress(message: ReplyMessage): string {
  return text(message.from?.emailAddress?.address || message.sender?.emailAddress?.address).toLowerCase()
}

/** Whole opportunity id only. "SW-010" does not count as "SW-01". */
export function subjectHasExactOpportunity(subject: string, opportunityId: string): boolean {
  const id = text(opportunityId)
  if (!id) return false
  return text(subject)
    .split(/\s+/)
    .some((word) => word === id)
}

export function matchSentApproval(
  messages: SentApprovalMessage[],
  opportunityId: string,
): SentApprovalMessage | null {
  return (
    messages.find(
      (message) =>
        subjectHasExactOpportunity(text(message.subject), opportunityId) && text(message.conversationId),
    ) || null
  )
}

/**
 * A reply counts only from tgates@tgttechnologies.com, on the saved thread,
 * and only after that approval was sent. Subject text is not the match.
 */
export function selectReply(message: ReplyMessage, tokens: TokenRecord[]): ReplySelection {
  const address = replySenderAddress(message)
  const decision = decisionFromReply(`${message.subject || ''}\n${message.bodyPreview || ''}`)
  if (address !== APPROVAL_RECIPIENT.toLowerCase()) {
    if (decision && /^re:/i.test(text(message.subject))) return { action: 'ignore-sender', address: address || '(none)' }
    return { action: 'skip' }
  }
  if (!decision || message.isDraft || !/^re:/i.test(text(message.subject))) return { action: 'skip' }
  const received = text(message.receivedDateTime)
  const conversationId = text(message.conversationId)
  if (!received || !conversationId) return { action: 'skip' }
  const record = tokens.find((token) => {
    if (token.used || !token.sentAt || !token.conversationId) return false
    return token.conversationId === conversationId && received > token.sentAt
  })
  if (!record) return { action: 'skip' }
  return { action: 'apply', record, decision }
}

/** Keeps newer mail and follows later pages until a page reaches the send time. */
export function collectMessagesAfter(pages: ReplyMessage[][], sentAt: string): ReplyMessage[] {
  const kept: ReplyMessage[] = []
  const since = text(sentAt)
  for (const page of pages) {
    let reachedSent = false
    for (const message of page) {
      const received = text(message.receivedDateTime)
      if (received && since && received <= since) {
        reachedSent = true
        continue
      }
      kept.push(message)
    }
    if (reachedSent) break
  }
  return kept
}

async function readJson(res: Response): Promise<{ value?: unknown[]; '@odata.nextLink'?: string; error?: { code?: string } }> {
  return (await res.json().catch(() => ({}))) as {
    value?: unknown[]
    '@odata.nextLink'?: string
    error?: { code?: string }
  }
}

async function listSentApprovalMessages(): Promise<SentApprovalMessage[]> {
  const found: SentApprovalMessage[] = []
  let next: string | null =
    "/me/mailFolders/sentitems/messages?$top=50&$select=subject,conversationId,sentDateTime&$filter=startswith(subject,'TGT approval')"
  while (next) {
    const res = await graphFetch(next)
    const body = await readJson(res)
    if (!res.ok) {
      const code = body.error?.code || 'graph_error'
      throw new Error(`Sent approval lookup failed (HTTP ${res.status} ${code}).`)
    }
    for (const item of body.value || []) {
      const message = item as SentApprovalMessage
      if (text(message.subject).startsWith('TGT approval')) found.push(message)
    }
    next = body['@odata.nextLink'] ? graphPathFromNext(body['@odata.nextLink']) : null
  }
  return found
}

async function attachMissingThreads(store: ApprovalStore, log: (line: string) => void): Promise<void> {
  const missing = Object.values(store.tokens).filter((token) => !token.used && !token.conversationId)
  if (missing.length === 0) return
  const sent = await listSentApprovalMessages()
  for (const token of missing) {
    const match = matchSentApproval(sent, token.opportunityId)
    const conversationId = text(match?.conversationId)
    const sentAt = text(match?.sentDateTime)
    if (!conversationId || !sentAt) {
      log(`[pipeline-approval] no thread id for ${token.opportunityId}`)
      continue
    }
    token.conversationId = conversationId
    token.sentAt = sentAt
    log(`[pipeline-approval] saved thread for ${token.opportunityId}`)
  }
  saveApprovalStore(store)
}

async function readRepliesAfter(sentAt: string, log: (line: string) => void): Promise<ReplyMessage[] | null> {
  const collected: ReplyMessage[] = []
  let next: string | null =
    '/me/messages?$top=50&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,isDraft,conversationId,receivedDateTime,from,sender'
  while (next) {
    const res = await graphFetch(next)
    const body = await readJson(res)
    if (!res.ok) {
      log(`[pipeline-approval] reply check skipped: HTTP ${res.status}`)
      return null
    }
    const page = (body.value || []) as ReplyMessage[]
    let reachedSent = false
    for (const message of page) {
      const received = text(message.receivedDateTime)
      if (received && received <= sentAt) {
        reachedSent = true
        continue
      }
      collected.push(message)
    }
    if (reachedSent || !body['@odata.nextLink']) break
    next = graphPathFromNext(body['@odata.nextLink'])
  }
  return collected
}

/** Reads a reply of APPROVE or REJECT. Mail.Read is required. The original approval email is ignored. */
export async function applyApprovalReplies(log: (line: string) => void = console.log): Promise<void> {
  const store = loadApprovalStore()
  await attachMissingThreads(store, log)
  const pending = Object.values(store.tokens).filter((token) => !token.used && token.sentAt && token.conversationId)
  if (pending.length === 0) {
    saveApprovalStore(store)
    return
  }
  const since = pending.map((token) => text(token.sentAt)).sort()[0]
  const messages = await readRepliesAfter(since, log)
  if (!messages) return
  for (const message of messages) {
    const id = text(message.id)
    if (!id || store.appliedReplyIds.includes(id)) continue
    const selection = selectReply(message, Object.values(store.tokens))
    if (selection.action === 'ignore-sender') {
      log(`[pipeline-approval] ignored reply from ${selection.address}`)
      continue
    }
    if (selection.action !== 'apply') continue
    await writeApprovalResult(selection.record.itemId, selection.decision)
    selection.record.used = true
    store.appliedReplyIds.push(id)
    log(`[pipeline-approval] reply ${selection.decision} item ${selection.record.itemId} ${selection.record.opportunityId}`)
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
