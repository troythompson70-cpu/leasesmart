import assert from 'node:assert/strict'
import { validateIntakePayload } from '../src/lib/intake-validate.ts'

function pass(name) {
  console.log(`PASS ${name}`)
}

{
  const result = validateIntakePayload(null)
  assert.equal(result.ok, false)
  pass('rejects null body')
}

{
  const result = validateIntakePayload({
    schemaVersion: '1.1',
    requestType: 'laptop_inquiry',
    submissionId: 'not-a-uuid',
    name: 'Troy',
    email: 'troy@example.com',
    bestCallbackNumber: '555-0100',
    message: 'Want the laptop',
    offer: '280-ai-laptop',
    source: 'tgt-website-laptop',
  })
  assert.equal(result.ok, false)
  pass('rejects non-uuid submissionId')
}

{
  const result = validateIntakePayload({
    schemaVersion: '1.1',
    requestType: 'laptop_inquiry',
    submissionId: '11111111-1111-4111-8111-111111111111',
    name: 'Troy',
    email: 'troy@example.com',
    bestCallbackNumber: '555-0100',
    message: "I'm interested in the $280 AI-Ready Laptop.",
    offer: '280-ai-laptop',
    source: 'tgt-website-laptop',
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.requestType, 'laptop_inquiry')
    assert.equal(result.delivery, 'confirmed')
  }
  pass('accepts valid laptop_inquiry')
}

{
  const result = validateIntakePayload({
    schemaVersion: '1.1',
    requestType: 'assessment',
    submissionId: '22222222-2222-4222-8222-222222222222',
    name: 'Troy',
    email: 'troy@example.com',
    bestCallbackNumber: '555-0100',
    message: 'Interest: $280 AI-ready laptop',
    source: 'tgt-website-laptop',
  })
  assert.equal(result.ok, true)
  pass('accepts assessment fallback shape')
}

{
  const result = validateIntakePayload({
    schemaVersion: '1.1',
    requestType: 'laptop_inquiry',
    submissionId: '33333333-3333-4333-8333-333333333333',
    name: 'Troy',
    email: 'bad-email',
    bestCallbackNumber: '555-0100',
    offer: '280-ai-laptop',
  })
  assert.equal(result.ok, false)
  pass('rejects invalid email on laptop_inquiry')
}

console.log('All intake validation checks passed.')
