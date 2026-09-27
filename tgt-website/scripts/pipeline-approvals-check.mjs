/**
 * No double-send and one-time tokens. No network.
 * Run: node --experimental-strip-types scripts/pipeline-approvals-check.mjs
 */
import assert from 'node:assert/strict'
import {
  approvalMessage,
  approvalWriteBack,
  collectMessagesAfter,
  consumeToken,
  decisionFromReply,
  emptyStore,
  issueToken,
  matchSentApproval,
  rowsNeedingApproval,
  selectReply,
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

{
  const sw01 = {
    itemId: '1',
    opportunityId: 'SW-01',
    used: false,
    conversationId: 'thread-sw-01',
    sentAt: '2026-09-27T00:00:00Z',
  }
  const sw010 = {
    itemId: '2',
    opportunityId: 'SW-010',
    used: false,
    conversationId: 'thread-sw-010',
    sentAt: '2026-09-27T00:00:00Z',
  }
  const outside = selectReply(
    {
      id: 'msg-outside',
      subject: 'Re: TGT approval SW-010 Cisco',
      bodyPreview: 'APPROVE',
      conversationId: 'thread-sw-010',
      receivedDateTime: '2026-09-27T01:00:00Z',
      from: { emailAddress: { address: 'stranger@example.com' } },
    },
    [sw01, sw010],
  )
  assert.equal(outside.action, 'ignore-sender')
  if (outside.action === 'ignore-sender') assert.equal(outside.address, 'stranger@example.com')
  pass('an outside sender saying APPROVE is ignored')
}

{
  const sw01 = {
    itemId: '1',
    opportunityId: 'SW-01',
    used: false,
    conversationId: 'thread-sw-01',
    sentAt: '2026-09-27T00:00:00Z',
  }
  const sw010 = {
    itemId: '2',
    opportunityId: 'SW-010',
    used: false,
    conversationId: 'thread-sw-010',
    sentAt: '2026-09-27T00:00:00Z',
  }
  const subject = 'Re: TGT approval SW-010 Cisco'
  assert.equal(subject.includes('SW-01'), true)
  const selected = selectReply(
    {
      id: 'msg-sw-010',
      subject,
      bodyPreview: 'APPROVE',
      conversationId: 'thread-sw-010',
      receivedDateTime: '2026-09-27T01:00:00Z',
      from: { emailAddress: { address: 'tgates@tgttechnologies.com' } },
    },
    [sw01, sw010],
  )
  assert.equal(selected.action, 'apply')
  if (selected.action === 'apply') assert.equal(selected.record.opportunityId, 'SW-010')
  const sent = matchSentApproval(
    [{ subject: 'TGT approval SW-010 Cisco', conversationId: 'thread-sw-010', sentDateTime: '2026-09-27T00:00:00Z' }],
    'SW-01',
  )
  assert.equal(sent, null)
  const newer = Array.from({ length: 20 }, (_, index) => ({
    id: `new-${index}`,
    receivedDateTime: '2026-09-27T02:00:00Z',
  }))
  const reply = {
    id: 'msg-sw-010',
    subject,
    bodyPreview: 'APPROVE',
    conversationId: 'thread-sw-010',
    receivedDateTime: '2026-09-27T01:00:00Z',
    from: { emailAddress: { address: 'tgates@tgttechnologies.com' } },
  }
  const older = [{ id: 'old', receivedDateTime: '2026-09-26T23:00:00Z' }]
  const collected = collectMessagesAfter([newer, [reply], older], '2026-09-27T00:00:00Z')
  assert.equal(collected.some((message) => message.id === 'msg-sw-010'), true)
  assert.equal(collected.some((message) => message.id === 'old'), false)
  pass('SW-01 does not match SW-010')
}

console.log('pipeline-approvals-check: all passed')
