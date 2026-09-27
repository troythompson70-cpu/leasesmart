/**
 * Creates TGT Helper State on the personal site and round-trips one row.
 * Reads Graph env already in the process. Prints the list id only.
 */
import { readFileSync } from 'node:fs'
import { graphFetch } from '../server/graph-sharepoint.ts'
import { PERSONAL_SITE_ID } from '../server/system-mode.ts'
import { HELPER_STATE_LIST_NAME, SharePointHelperState } from '../server/helper-state.ts'

const envFile = process.env.HELPER_ENV_FILE
if (envFile) {
  for (const line of readFileSync(envFile, 'utf8').split(/\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

const listed = await graphFetch(`/sites/${PERSONAL_SITE_ID}/lists?$select=id,displayName&$top=200`)
const body = await listed.json()
if (!listed.ok) {
  console.log(`LIST_LOOKUP_FAIL ${listed.status}`)
  process.exit(1)
}
let listId = (body.value || []).find((row) => row.displayName === HELPER_STATE_LIST_NAME)?.id
if (!listId) {
  const created = await graphFetch(`/sites/${PERSONAL_SITE_ID}/lists`, {
    method: 'POST',
    body: JSON.stringify({
      displayName: HELPER_STATE_LIST_NAME,
      columns: [{ name: 'Payload', text: { allowMultipleLines: true, maxLength: 60000 } }],
      list: { template: 'genericList' },
    }),
  })
  const createdBody = await created.json()
  if (!created.ok) {
    console.log(`LIST_CREATE_FAIL ${created.status} ${createdBody.error?.code || ''}`)
    process.exit(1)
  }
  listId = createdBody.id
  console.log('LIST_CREATED')
} else {
  console.log('LIST_EXISTS')
}
process.env.HELPER_STATE_LIST_ID = listId
const state = new SharePointHelperState()
const sample = { ok: true, n: 1 }
await state.write('sprint2-roundtrip', sample)
const read = await state.read('sprint2-roundtrip')
if (JSON.stringify(read) !== JSON.stringify(sample)) {
  console.log('ROUNDTRIP_FAIL')
  process.exit(1)
}
console.log(`ROUNDTRIP_PASS ${listId}`)
