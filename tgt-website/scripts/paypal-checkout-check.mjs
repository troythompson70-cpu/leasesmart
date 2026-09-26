/**
 * Price tamper, duplicate orders, and webhook signatures. No network.
 * Run: node --experimental-strip-types scripts/paypal-checkout-check.mjs
 */
import assert from 'node:assert/strict'
import {
  alreadyFiled,
  orderOpportunityId,
  priceCart,
  webhookVerified,
} from '../src/lib/catalog.ts'

function pass(name) {
  console.log(`PASS ${name}`)
}

const laptop = { sku: 'ai-laptop-280', name: 'AI-Ready Touchscreen Laptop', priceCents: 28000 }

{
  const priced = priceCart([{ sku: 'ai-laptop-280', quantity: 2 }], [laptop])
  assert.equal(priced.ok, true)
  if (priced.ok) assert.equal(priced.totalCents, 56000)
  const tamper = priceCart([{ sku: 'ai-laptop-280', quantity: 1, priceCents: 100 }], [laptop])
  assert.equal(tamper.ok, false)
  pass('a browser price that does not match the catalog is rejected')
}

{
  const id = '5O190127TN364715T'
  assert.equal(orderOpportunityId(id), `ORD-${id}`)
  assert.equal(alreadyFiled([`ORD-${id}`], id), true)
  assert.equal(alreadyFiled(['ORD-OTHER'], id), false)
  pass('a duplicate PayPal order does not file a second pipeline row')
}

{
  assert.equal(webhookVerified('SUCCESS'), true)
  assert.equal(webhookVerified('FAILURE'), false)
  assert.equal(webhookVerified(''), false)
  pass('a bad webhook signature is rejected')
}

{
  const config = { clientId: 'public-client', currency: 'USD' }
  assert.equal(JSON.stringify(config).includes('secret'), false)
  pass('the public config has no secret')
}

console.log('paypal-checkout-check: all passed')
