/**
 * Copies TGT Website Leads & Launch Status rows into TGT Pipeline.
 * opportunity_id is WEB- plus the source list item id, so a second pass skips it.
 * Does not send mail, does not mark VERIFIED, and does not delete rows.
 */
import { beginCycle, endCycle } from './helper-heartbeat.ts'
import { graphFetch } from './graph-sharepoint.ts'
import { replaceInterval } from './process-loops.ts'

export const TEAM_SITE_ID =
  'netorgft7859571.sharepoint.com,30503ad7-421e-4dde-85e8-bc446af5fab4,41146896-bbd7-416c-ac8d-f454eb4f3a61'
export const WEBSITE_LEADS_LIST_ID = '23b88006-83a0-46c6-a459-1a0a3bf9ecca'
export const PIPELINE_LIST_ID = '5b557f10-e241-4d0d-874a-d251d15db9bb'
export const WEBSITE_LEAD_COPY_INTERVAL_MS = 15 * 60 * 1000

const LEADS_LIST_NAME = 'TGT Website Leads & Launch Status'

export type WebsiteLead = {
  id: string
  title: string
  company: string
  email: string
  source: string
  ownerNotes: string
  submittedAt: string
}

export type PipelineCopyFields = {
  Title: string
  opportunity_id: string
  company: string
  buyer_or_contact: string
  contact_route: 'Website form'
  lane: 'Website Lead'
  priority: 'Tier 2'
  status: 'NEW'
  need: string
  source_date: string
  source_reference: string
  incoming_attention: true
  last_updated: string
}

export type WebsiteLeadCopyResult = {
  sourceId: string
  opportunityId: string
  pipelineItemId: string
}

type GraphListPayload = {
  value?: Array<{ id?: string; fields?: Record<string, unknown> }>
  '@odata.nextLink'?: string
  error?: { code?: string; message?: string }
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

export function opportunityIdForLead(sourceItemId: string): string {
  const id = text(sourceItemId)
  if (!id) throw new Error('Website lead source item id is required.')
  return `WEB-${id}`
}

/** Leads whose WEB-{id} is not already on the pipeline. One row per source id. */
export function selectLeadsToCopy(
  leads: WebsiteLead[],
  existingOpportunityIds: Iterable<string>,
): WebsiteLead[] {
  const have = new Set(Array.from(existingOpportunityIds, (id) => text(id)).filter(Boolean))
  const chosen: WebsiteLead[] = []
  const seen = new Set<string>()
  for (const lead of leads) {
    const opportunityId = opportunityIdForLead(lead.id)
    if (have.has(opportunityId) || seen.has(opportunityId)) continue
    seen.add(opportunityId)
    chosen.push(lead)
  }
  return chosen
}

export function easternStamp(now: Date): { date: string; timestamp: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((part) => [part.type, part.value]))
  const date = `${parts.year}-${parts.month}-${parts.day}`
  const offset = String(parts.timeZoneName || 'GMT-04:00').replace('GMT', '')
  return {
    date,
    timestamp: `${date}T${parts.hour}:${parts.minute}:${parts.second}${offset}`,
  }
}

export function pipelineFieldsForLead(lead: WebsiteLead, now = new Date()): PipelineCopyFields {
  const opportunityId = opportunityIdForLead(lead.id)
  const stamp = easternStamp(now)
  const company = lead.company || lead.title || 'Website lead'
  const buyer = lead.title || lead.email || company
  const sourceName = lead.source || LEADS_LIST_NAME
  const submittedDay = /^\d{4}-\d{2}-\d{2}/.test(lead.submittedAt)
    ? lead.submittedAt.slice(0, 10)
    : stamp.date
  return {
    Title: opportunityId,
    opportunity_id: opportunityId,
    company,
    buyer_or_contact: buyer,
    contact_route: 'Website form',
    lane: 'Website Lead',
    priority: 'Tier 2',
    status: 'NEW',
    need: lead.ownerNotes || lead.source || 'Website form submission',
    source_date: submittedDay,
    source_reference: `${sourceName} item ${lead.id}`,
    incoming_attention: true,
    last_updated: stamp.timestamp,
  }
}

function graphPathFromNext(nextLink: string): string {
  const marker = '/v1.0'
  const at = nextLink.indexOf(marker)
  if (at === -1) throw new Error('Graph next link is not a v1.0 URL.')
  return nextLink.slice(at + marker.length)
}

async function readListItems(listId: string): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const rows: Array<{ id: string; fields: Record<string, unknown> }> = []
  let path: string | null =
    `/sites/${TEAM_SITE_ID}/lists/${listId}/items?$expand=fields&$top=200`
  while (path) {
    const res = await graphFetch(path)
    const body = (await res.json().catch(() => ({}))) as GraphListPayload
    if (!res.ok) {
      const code = body.error?.code || 'graph_error'
      throw new Error(`Graph list read failed (HTTP ${res.status} ${code}).`)
    }
    for (const item of body.value || []) {
      const id = text(item.id || item.fields?.id)
      if (!id) continue
      rows.push({ id, fields: item.fields || {} })
    }
    path = body['@odata.nextLink'] ? graphPathFromNext(body['@odata.nextLink']) : null
  }
  return rows
}

function leadFromItem(item: { id: string; fields: Record<string, unknown> }): WebsiteLead {
  return {
    id: item.id,
    title: text(item.fields.Title || item.fields.LinkTitle),
    company: text(item.fields.Company),
    email: text(item.fields.Email),
    source: text(item.fields.Source),
    ownerNotes: text(item.fields.OwnerNotes),
    submittedAt: text(item.fields.SubmittedAt),
  }
}

export async function readWebsiteLeads(): Promise<WebsiteLead[]> {
  const items = await readListItems(WEBSITE_LEADS_LIST_ID)
  return items.map(leadFromItem)
}

export async function readPipelineOpportunityIds(): Promise<Set<string>> {
  const items = await readListItems(PIPELINE_LIST_ID)
  const ids = new Set<string>()
  for (const item of items) {
    const opportunityId = text(item.fields.opportunity_id)
    if (opportunityId) ids.add(opportunityId)
  }
  return ids
}

async function createPipelineItem(fields: PipelineCopyFields): Promise<string> {
  const res = await graphFetch(`/sites/${TEAM_SITE_ID}/lists/${PIPELINE_LIST_ID}/items`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    id?: string
    error?: { code?: string }
  }
  if (!res.ok || !body.id) {
    const code = body.error?.code || 'graph_error'
    throw new Error(`Pipeline create failed (HTTP ${res.status} ${code}).`)
  }
  return String(body.id)
}

export async function copyNewWebsiteLeads(
  log: (line: string) => void = console.log,
): Promise<WebsiteLeadCopyResult[]> {
  const [leads, existing] = await Promise.all([readWebsiteLeads(), readPipelineOpportunityIds()])
  const pending = selectLeadsToCopy(leads, existing)
  const copied: WebsiteLeadCopyResult[] = []
  for (const lead of pending) {
    const fields = pipelineFieldsForLead(lead)
    const pipelineItemId = await createPipelineItem(fields)
    existing.add(fields.opportunity_id)
    const result = {
      sourceId: lead.id,
      opportunityId: fields.opportunity_id,
      pipelineItemId,
    }
    copied.push(result)
    log(
      `[website-lead-copy] copied source ${result.sourceId} -> ${result.opportunityId} pipeline item ${result.pipelineItemId}`,
    )
  }
  return copied
}

/** Runs once immediately, then every 15 minutes. A Vite restart replaces the previous timer. */
export function startWebsiteLeadCopyLoop(log: (line: string) => void = console.log): void {
  log('[website-lead-copy] started')
  replaceInterval(
    'website-lead-copy',
    () => {
      beginCycle('website-lead-copy')
      void copyNewWebsiteLeads(log)
        .then((copied) => {
          endCycle('website-lead-copy')
          log(`[website-lead-copy] cycle copied ${copied.length}`)
        })
        .catch((err: unknown) => {
          endCycle('website-lead-copy')
          const message = err instanceof Error ? err.message : String(err)
          log(`[website-lead-copy] tick failed: ${message}`)
        })
    },
    WEBSITE_LEAD_COPY_INTERVAL_MS,
  )
}
