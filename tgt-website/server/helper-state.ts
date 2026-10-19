/**
 * Cloud runner state. One SharePoint row per key. The JSON payload is the same shape as the Mac files.
 */
import { graphFetch } from './graph-sharepoint.ts'
import { PERSONAL_SITE_ID } from './system-mode.ts'
export type HelperState = {
  read(key: string): Promise<unknown>
  write(key: string, value: unknown): Promise<void>
}

export class MemoryHelperState implements HelperState {
  private rows = new Map<string, string>()

  async write(key: string, value: unknown): Promise<void> {
    this.rows.set(key, JSON.stringify(value))
  }

  async read(key: string): Promise<unknown> {
    const raw = this.rows.get(key)
    if (raw === undefined) return null
    return JSON.parse(raw) as unknown
  }
}

export function statePayload(value: unknown): string {
  return JSON.stringify(value)
}

export function stateValue(payload: string | null | undefined): unknown {
  if (!payload) return null
  return JSON.parse(payload) as unknown
}

export const HELPER_STATE_LIST_NAME = 'TGT Helper State'

function listId(): string {
  const id = String(process.env.HELPER_STATE_LIST_ID || '').trim()
  if (!id) throw new Error('HELPER_STATE_LIST_ID is not set.')
  return id
}

type StateItem = { id?: string; fields?: { Title?: string; Payload?: string } }

export class SharePointHelperState implements HelperState {
  async read(key: string): Promise<unknown> {
    const item = await findItem(key)
    return stateValue(item?.fields?.Payload)
  }

  async write(key: string, value: unknown): Promise<void> {
    const payload = statePayload(value)
    const existing = await findItem(key)
    if (existing?.id) {
      const res = await graphFetch(`/sites/${PERSONAL_SITE_ID}/lists/${listId()}/items/${existing.id}/fields`, {
        method: 'PATCH',
        body: JSON.stringify({ Payload: payload }),
      })
      if (!res.ok) throw new Error(`Helper state update failed (HTTP ${res.status}).`)
      return
    }
    const res = await graphFetch(`/sites/${PERSONAL_SITE_ID}/lists/${listId()}/items`, {
      method: 'POST',
      body: JSON.stringify({ fields: { Title: key, Payload: payload } }),
    })
    if (!res.ok) throw new Error(`Helper state create failed (HTTP ${res.status}).`)
  }
}

async function findItem(key: string): Promise<StateItem | null> {
  const filter = encodeURIComponent(`fields/Title eq '${key.replace(/'/g, "''")}'`)
  const res = await graphFetch(
    `/sites/${PERSONAL_SITE_ID}/lists/${listId()}/items?$expand=fields($select=Title,Payload)&$filter=${filter}&$top=1`,
  )
  if (!res.ok) throw new Error(`Helper state read failed (HTTP ${res.status}).`)
  const body = (await res.json()) as { value?: StateItem[] }
  return body.value?.[0] || null
}
