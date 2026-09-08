import assert from 'node:assert/strict'
import { validateIntakePayload } from '../src/lib/intake-validate.ts'
import {
  isFabricatedProbeEmail,
  isProductionIntakeHost,
  assertSafeIntakeEmail,
} from '../src/lib/intake-probe-guard.ts'

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

{
  const result = validateIntakePayload({
    schemaVersion: '1.1',
    requestType: 'newsletter',
    submissionId: '44444444-4444-4444-8444-444444444444',
    email: 'person@company.com',
    newsletterConsent: true,
    phonePlatform: 'iphone',
    source: 'tgt-website-newsletter',
  })
  assert.equal(result.ok, true)
  pass('accepts valid newsletter')
}

{
  assert.equal(isFabricatedProbeEmail('live-diag@tgttechnologies.com'), true)
  assert.equal(isFabricatedProbeEmail('overnight-gateway-1@tgttechnologies.com'), true)
  assert.equal(isFabricatedProbeEmail('overnight-bridge@tgttechnologies.com'), true)
  assert.equal(isFabricatedProbeEmail('overnight-puppeteer@tgttechnologies.com'), true)
  assert.equal(isFabricatedProbeEmail('live-sp-map-1@tgttechnologies.com'), true)
  assert.equal(isFabricatedProbeEmail('final-check-1@tgttechnologies.com'), true)
  assert.equal(isFabricatedProbeEmail('live-ui-e2e-1@tgttechnologies.com'), true)
  assert.equal(isFabricatedProbeEmail('live-v3-1@tgttechnologies.com'), true)
  assert.equal(isFabricatedProbeEmail('cors2@tgttechnologies.com'), true)
  assert.equal(isFabricatedProbeEmail('cors-test@tgttechnologies.com'), true)
  assert.equal(isFabricatedProbeEmail('status-test@example.com'), true)
  assert.equal(isFabricatedProbeEmail('troy@tgttechnologies.com'), false)
  assert.equal(isFabricatedProbeEmail('customer@acme.com'), false)
  pass('classifies fabricated probe emails')
}

{
  assert.equal(isProductionIntakeHost('tgttechnologies.com'), true)
  assert.equal(isProductionIntakeHost('www.tgttechnologies.com'), true)
  assert.equal(isProductionIntakeHost('localhost'), false)
  assert.equal(isProductionIntakeHost('127.0.0.1'), false)
  const blocked = assertSafeIntakeEmail('status-test@example.com', 'tgttechnologies.com')
  assert.equal(blocked.ok, false)
  const localOk = assertSafeIntakeEmail('status-test@example.com', 'localhost')
  assert.equal(localOk.ok, true)
  pass('blocks probe emails on production host only')
}

{
  // Mirror src/lib/mailto.ts — encodeURIComponent, never URLSearchParams.
  const subject = encodeURIComponent('Labor Day $280 AI-Ready Laptop inquiry')
  const body = encodeURIComponent(
    "I'm interested in the $280 AI-Ready Laptop.\n\nName: Troy\nPhone: 555-0100",
  )
  const href = `mailto:info@tgttechnologies.com?subject=${subject}&body=${body}`
  assert.match(href, /^mailto:info@tgttechnologies\.com\?/)
  assert.equal(href.includes('+'), false)
  assert.equal(href.includes('%20'), true)
  assert.equal(href.includes('Name%3A%20Troy'), true)
  const bad = `mailto:info@tgttechnologies.com?${new URLSearchParams({
    subject: 'Labor Day $280 AI-Ready Laptop inquiry',
    body: 'Name: Troy',
  }).toString()}`
  assert.equal(bad.includes('+'), true)
  pass('mailto encodes spaces as %20 not + (URLSearchParams forbidden)')
}

console.log('All intake validation checks passed.')
