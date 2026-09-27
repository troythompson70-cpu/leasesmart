/**
 * No double-send and one-time tokens. No network.
 * Run: node --experimental-strip-types scripts/pipeline-approvals-check.mjs
 */
import assert from 'node:assert/strict'
import {
  approvalMessage,
  approvalWriteBack,
  consumeToken,
  decisionFromReply,
  emptyStore,
  issueToken,
  rowsNeedingApproval,
} from '../server/pipeline-approvals.ts'

function pass(name) {
  console.log(`PASS ${name}`)
}

const jane = {
  id: '42',
  opportunityId: 'WEB-1',
  company: 'Jane Test QA Co',
  nextAction: 'None',
  ownerApprovalRequired: 'Yes',
}
const real = { ...jane, id: '22', opportunityId: 'SW-006', company: 'Cisco', ownerApprovalRequired: 'Yes' }
const closed = { ...jane, id: '7', ownerApprovalRequired: 'No' }

{
  const first = rowsNeedingApproval([jane, real, closed], [])
  assert.deepEqual(first.map((row) => row.id), ['42', '22'])
  const second = rowsNeedingApproval([jane, real, closed], ['42'])
  assert.deepEqual(second.map((row) => row.id), ['22'])
  const third = rowsNeedingApproval([jane, jane], ['42'])
  assert.deepEqual(third, [])
  pass('a row already sent is not selected again')
}

{
  const store = emptyStore()
  const token = issueToken(store, jane)
  const first = consumeToken(store, token)
  assert.equal(first && first.itemId, '42')
  assert.equal(consumeToken(store, token), null)
  assert.equal(consumeToken(store, 'not-a-token'), null)
  pass('a token cannot be reused')
}

{
  assert.equal(decisionFromReply('APPROVE'), 'APPROVE')
  assert.equal(decisionFromReply('please REJECT this'), 'REJECT')
  assert.equal(decisionFromReply('APPROVE and REJECT'), null)
  assert.equal(decisionFromReply('looking at it'), null)
  const quoted = [
    'APPROVE',
    '',
    '-----Original Message-----',
    'Reply to this email with the single word APPROVE or REJECT.',
  ].join('\n')
  assert.equal(decisionFromReply(quoted), 'APPROVE')
  pass('a reply is APPROVE, REJECT, or neither')
}

{
  const approved = approvalWriteBack('APPROVE', new Date('2026-09-26T21:00:00Z'))
  assert.equal(approved.status, 'APPROVED')
  assert.equal(approved.owner_approval_required, 'No')
  assert.equal(approved.next_action, 'Approved by owner')
  assert.match(approved.last_updated, /^-?\d{4}-\d{2}-\d{2}T/)
  const rejected = approvalWriteBack('REJECT', new Date('2026-09-26T21:00:00Z'))
  assert.equal(rejected.status, 'PASS')
  assert.equal(rejected.next_action, 'Rejected by owner')
  pass('write-back clears the approval flag')
}

{
  const message = approvalMessage(jane, 'token')
  assert.equal(message.body.includes('127.0.0.1'), false)
  assert.match(message.body, /single word APPROVE/)
  assert.match(message.body, /single word REJECT/)
  pass('the email tells Troy to reply and has no local link')
}

console.log('pipeline-approvals-check: all passed')
