import { graphFetch } from './graph-sharepoint.ts'

export const PERSONAL_SITE_ID =
  'netorgft7859571-my.sharepoint.com,4a25806d-ffa5-4526-a4a1-a1cc1d406a62,3e8f2e73-918b-4fe9-b73e-7073913e49ef'
export const SYSTEM_MODE_LIST_ID = '8b25cf71-bc87-4e1b-93c1-6d27c4a5398f'
export const SYSTEM_MODE_ITEM_ID = '1'

export type SystemModeValue = 'RUN' | 'PAUSE' | 'SAFE' | 'DEGRADED' | 'STOPPED'

export async function readSystemMode(): Promise<string> {
  const res = await graphFetch(
    `/sites/${PERSONAL_SITE_ID}/lists/${SYSTEM_MODE_LIST_ID}/items/${SYSTEM_MODE_ITEM_ID}?expand=fields`,
  )
  if (!res.ok) throw new Error(`System Mode read failed (HTTP ${res.status}).`)
  const body = (await res.json()) as { fields?: { Mode?: string } }
  return String(body.fields?.Mode || '').trim()
}

export async function writeSystemMode(mode: SystemModeValue, reason: string): Promise<void> {
  const res = await graphFetch(
    `/sites/${PERSONAL_SITE_ID}/lists/${SYSTEM_MODE_LIST_ID}/items/${SYSTEM_MODE_ITEM_ID}/fields`,
    {
      method: 'PATCH',
      body: JSON.stringify({ Mode: mode, Reason: reason }),
    },
  )
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`System Mode write failed (HTTP ${res.status} ${detail.slice(0, 180)}).`)
  }
}
