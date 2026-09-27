/**
 * No-duplicate rule for website lead copies. No network.
 * Run: node scripts/website-lead-copy-check.mjs
 */
import assert from 'node:assert/strict'
import {
  opportunityIdForLead,
  pipelineFieldsForLead,
  selectLeadsToCopy,
} from '../server/website-lead-copy.ts'

function pass(name) {
  console.log(`PASS ${name}`)
}

const jane = {
  id: '41',
  title: 'Jane Test',
  company: 'Jane Test QA Co',
  email: 'jane.test.qa@example.com',
  source: 'Website form',
  ownerNotes: 'Need a callback about managed support.',
  submittedAt: '2026-09-26T15:00:00Z',
}

{
  assert.equal(opportunityIdForLead('41'), 'WEB-41')
  assert.equal(opportunityIdForLead(' 7 '), 'WEB-7')
  assert.throws(() => opportunityIdForLead(''), /source item id/)
  pass('opportunity id is WEB- plus the source item id')
}

{
  const first = selectLeadsToCopy([jane], [])
  assert.equal(first.length, 1)
  assert.equal(first[0].id, '41')
  const second = selectLeadsToCopy([jane], ['WEB-41'])
  assert.deepEqual(second, [])
  pass('a source item already copied is not selected again')
}

{
  const twin = { ...jane, title: 'Jane Test again' }
  const selected = selectLeadsToCopy([jane, twin], [])
  assert.equal(selected.length, 1)
  assert.equal(selected[0].title, 'Jane Test')
  pass('the same source id is copied once even if it appears twice')
}

{
  const other = { ...jane, id: '99', title: 'Other' }
  const selected = selectLeadsToCopy([jane, other], ['WEB-41'])
  assert.deepEqual(selected.map((lead) => lead.id), ['99'])
  pass('only the uncopied source id is selected')
}

{
  const fields = pipelineFieldsForLead(jane, new Date('2026-09-26T19:30:00Z'))
  assert.equal(fields.opportunity_id, 'WEB-41')
  assert.equal(fields.company, 'Jane Test QA Co')
  assert.equal(fields.buyer_or_contact, 'Jane Test')
  assert.equal(fields.contact_route, 'Website form')
  assert.equal(fields.lane, 'Website Lead')
  assert.equal(fields.priority, 'Tier 2')
  assert.equal(fields.status, 'NEW')
  assert.equal(fields.need, 'Need a callback about managed support.')
  assert.equal(fields.source_date, '2026-09-26')
  assert.equal(fields.source_reference, 'Website form item 41')
  assert.equal(fields.incoming_attention, true)
  assert.match(fields.last_updated, /^2026-09-26T15:30:00-04:00$/)
  pass('B4 fields are filled from the source item')
}

console.log('website-lead-copy-check: all passed')
