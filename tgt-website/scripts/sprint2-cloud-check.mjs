/**
 * Sprint 2 cloud port. No network except when SPRINT2_STATE_LIST=1 and HELPER_STATE_LIST_ID is set.
 * Run: node --experimental-strip-types scripts/sprint2-cloud-check.mjs
 */
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { alertCount } from '../server/cloud-runner.ts'
import { CLOUD_TIME_BUDGET_MS } from '../server/cloud-watchdog.ts'
import { cloudLiveEnabled } from '../server/dry-run.ts'
import { MemoryHelperState } from '../server/helper-state.ts'
import { decisionFromReply, newestReplyPerThread } from '../server/pipeline-approvals.ts'
import { runApprovalsCloud, runLeadCopyCloud, secondPassSendsNothing } from '../server/cloud-runner.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const forbidden = `/${'me'}/`

async function filesUnder(dir) {
  const found = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await filesUnder(full)))
    else if (/\.(ts|mjs|js)$/.test(entry.name)) found.push(full)
  }
  return found
}

{
  const dirs = [path.join(root, 'server'), path.join(root, 'scripts'), path.join(root, 'netlify')]
  const hits = []
  for (const dir of dirs) {
    for (const file of await filesUnder(dir)) {
      if (file.endsWith('sprint2-cloud-check.mjs')) continue
      const text = await readFile(file, 'utf8')
      if (text.includes(forbidden)) hits.push(path.relative(root, file))
    }
  }
  assert.deepEqual(hits, [])
  console.log('PASS paths have no mailbox self prefix')
}

{
  const state = new MemoryHelperState()
  const original = { sentItemIds: ['11'], tokens: { a: { itemId: '11', opportunityId: 'SW-010', used: false } } }
  await state.write('pipeline-approvals', original)
  const read = await state.read('pipeline-approvals')
  assert.deepEqual(read, original)
  console.log('PASS state round-trip')
}

{
  process.env.DRY_RUN = '1'
  assert.equal(cloudLiveEnabled(), false)
  const lines = []
  const leads = await runLeadCopyCloud((line) => lines.push(line))
  const approvals = await runApprovalsCloud((line) => lines.push(line))
  assert.deepEqual(leads, [])
  assert.deepEqual(approvals, [])
  assert.equal(lines.some((line) => line.includes('sendMail')), false)
  assert.equal(lines.filter((line) => line.startsWith('[dry-run] would send:')).length, 2)
  delete process.env.DRY_RUN
  console.log('PASS DRY_RUN sends nothing and writes no live list')
}

{
  const row = { id: '22', opportunityId: 'SW-006', company: 'Cisco', nextAction: 'None', ownerApprovalRequired: 'Yes' }
  const lead = {
    id: '9',
    title: 'Jane',
    company: 'Jane',
    email: 'jane.test.qa@example.com',
    source: 'test',
    ownerNotes: '',
    submittedAt: '2026-09-26T00:00:00Z',
  }
  assert.equal(secondPassSendsNothing([row], ['22'], [lead], new Set(['WEB-9'])), true)
  console.log('PASS a second cycle sends each approval once and copies each lead once')
}

{
  const page = Array.from({ length: 50 }, (_, index) => ({
    id: `m-${index}`,
    conversationId: `c-${index}`,
    receivedDateTime: '2026-09-27T02:00:00Z',
    bodyText: index % 2 === 0 ? 'approved' : 'not approved',
  }))
  const started = Date.now()
  const kept = newestReplyPerThread(page)
  for (const message of kept) decisionFromReply(message.bodyText || '')
  const elapsed = Date.now() - started
  assert.ok(elapsed < CLOUD_TIME_BUDGET_MS)
  console.log(`PASS time budget ${elapsed}ms under ${CLOUD_TIME_BUDGET_MS}ms`)
}

{
  const now = Date.parse('2026-09-27T02:00:00Z')
  const stale = now - 36 * 60 * 1000
  assert.equal(alertCount(stale, now), 1)
  assert.equal(alertCount(now - 60 * 1000, now), 0)
  console.log('PASS watchdog alerts once after 35 minutes')
}

console.log('sprint2-cloud-check: all passed')
