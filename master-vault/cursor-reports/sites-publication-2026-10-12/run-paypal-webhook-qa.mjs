import assert from 'node:assert/strict'
import { CHECKOUT_PRICE, TEST_CHECKOUT_PRICE, handlePayPalCaptureOrder, handlePayPalConfig, handlePayPalCreateOrder, handlePayPalWebhook, PAYPAL_LIVE_API } from './paypal.js'

const env = {
  PAYPAL_CLIENT_ID: 'live-client-id',
  PAYPAL_CLIENT_SECRET: 'live-secret',
  PAYPAL_ENVIRONMENT: 'live',
  PAYPAL_WEBHOOK_ID: '6D251538KE580724X',
  MS_TENANT_ID: 'tenant-id',
  MS_CLIENT_ID: 'client-id',
  MS_CLIENT_SECRET: 'client-secret',
  MAIL_SENDER: 'tgates@tgttechnologies.com',
  OWNER_EMAIL: 'tgates@tgttechnologies.com',
}
const shipTo = {
  name: 'Jane Test',
  line1: '2211 N First St',
  city: 'San Jose',
  state: 'CA',
  postalCode: '95131',
  country: 'US',
}
const event = {
  id: 'WH-TEST-1',
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  resource: {
    id: 'CAPTURE-1',
    custom_id: 'laptop-lenovo',
    amount: { currency_code: 'USD', value: '280.00' },
    payer: { email_address: 'buyer@example.com', name: { given_name: 'Jane', surname: 'Test' } },
    supplementary_data: { related_ids: { order_id: 'ORDER123456789' } },
    purchase_units: [{
      custom_id: 'laptop-lenovo',
      amount: { currency_code: 'USD', value: '280.00' },
      items: [{ name: 'Refurbished Lenovo laptop', description: 'buyer@example.com' }],
      shipping: {
        name: { full_name: 'Jane Test' },
        address: {
          address_line_1: '2211 N First St',
          admin_area_2: 'San Jose',
          admin_area_1: 'CA',
          postal_code: '95131',
          country_code: 'US',
        },
      },
    }],
  },
}
const headers = {
  'content-type': 'application/json',
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-cert-url': 'https://api-m.paypal.com/cert.pem',
  'paypal-transmission-id': 'transmission-1',
  'paypal-transmission-sig': 'signature',
  'paypal-transmission-time': '2026-09-26T20:00:00Z',
}
const calls = []
const fetchImpl = async (url, options) => {
  calls.push({ url, options })
  if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'token' })
  if (url.endsWith('/v1/notifications/verify-webhook-signature')) {
    const sent = JSON.parse(options.body)
    assert.equal(sent.webhook_id, env.PAYPAL_WEBHOOK_ID)
    assert.deepEqual(sent.webhook_event, event)
    return Response.json({ verification_status: 'SUCCESS' })
  }
  if (url.endsWith('/v2/checkout/orders')) {
    const sent = JSON.parse(options.body)
    assert.equal(sent.purchase_units[0].shipping.address.address_line_1, '2211 N First St')
    assert.equal(sent.purchase_units[0].shipping.address.postal_code, '95131')
    assert.equal(sent.payment_source.paypal.experience_context.shipping_preference, 'SET_PROVIDED_ADDRESS')
    if (sent.purchase_units[0].items[0].name === 'TGT TEST ORDER - DO NOT SHIP') {
      assert.equal(sent.purchase_units[0].amount.value, '1.00')
      assert.match(sent.purchase_units[0].description, /TGT TEST ORDER - DO NOT SHIP/)
      assert.match(sent.purchase_units[0].items[0].description, /buyer@example.com/)
      return Response.json({ id: 'ORDERTEST123', links: [{ rel: 'payer-action', href: 'https://www.paypal.com/checkoutnow?token=ORDERTEST123' }] })
    }
    assert.equal(sent.purchase_units[0].amount.value, '280.00')
    assert.equal(sent.purchase_units[0].items[0].name, 'Refurbished Lenovo laptop')
    assert.equal(sent.purchase_units[0].items[0].description, 'buyer@example.com')
    return Response.json({ id: 'ORDER123456', links: [{ rel: 'payer-action', href: 'https://www.paypal.com/checkoutnow?token=ORDER123456' }] })
  }
  if (url.endsWith('/v2/checkout/orders/ORDER123456789') && options?.method === 'GET') {
    return Response.json({
      id: 'ORDER123456789',
      purchase_units: [{ amount: { currency_code: 'USD', value: '280.00' }, items: [{ name: 'Refurbished Lenovo laptop' }] }],
    })
  }
  if (url.endsWith('/v2/checkout/orders/ORDER123456789/capture')) {
    return Response.json({ ...event.resource, id: 'ORDER123456789', status: 'COMPLETED' })
  }
  if (url === 'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token') {
    const sent = new URLSearchParams(options.body)
    assert.equal(sent.get('grant_type'), 'client_credentials')
    assert.equal(sent.get('scope'), 'https://graph.microsoft.com/.default')
    assert.equal(sent.get('client_id'), 'client-id')
    return Response.json({ access_token: 'graph-token' })
  }
  if (url === 'https://graph.microsoft.com/v1.0/users/tgates%40tgttechnologies.com/sendMail') {
    const sent = JSON.parse(options.body)
    assert.equal(sent.saveToSentItems, true)
    assert.equal(sent.message.body.contentType, 'Text')
    assert.equal(sent.message.replyTo[0].emailAddress.address, 'info@tgttechnologies.com')
    const to = sent.message.toRecipients[0].emailAddress.address
    if (to === 'tgates@tgttechnologies.com') {
      assert.match(sent.message.body.content, /2211 N First St/)
      assert.match(sent.message.body.content, /San Jose, CA, 95131/)
      assert.match(sent.message.body.content, /only to TGT/)
      assert.match(sent.message.body.content, /ORDER123456789/)
    } else if (to === 'buyer@example.com') {
      assert.match(sent.message.body.content, /2211 N First St/)
      assert.match(sent.message.body.content, /Brand: Lenovo/)
      assert.match(sent.message.body.content, /If any line is wrong/)
    } else {
      throw new Error(`unexpected recipient ${to}`)
    }
    return new Response(null, { status: 202 })
  }
  throw new Error(`unexpected URL ${url}`)
}

const config = await handlePayPalConfig(new Request('https://example.test/api/paypal/config'), env)
assert.equal(config.status, 200)
assert.deepEqual(await config.json(), { clientId: env.PAYPAL_CLIENT_ID, environment: 'live', notificationsConfigured: true })
assert.equal(CHECKOUT_PRICE, '280.00')
assert.equal(TEST_CHECKOUT_PRICE, '1.00')

const unconfiguredConfig = await handlePayPalConfig(new Request('https://example.test/api/paypal/config'), {
  PAYPAL_CLIENT_ID: env.PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET: env.PAYPAL_CLIENT_SECRET,
  PAYPAL_ENVIRONMENT: 'live',
  PAYPAL_WEBHOOK_ID: env.PAYPAL_WEBHOOK_ID,
})
assert.equal(unconfiguredConfig.status, 200)
assert.equal((await unconfiguredConfig.json()).notificationsConfigured, false)

const order = await handlePayPalCreateOrder(new Request('https://example.test/api/paypal/create-order', {
  method: 'POST',
  body: JSON.stringify({ brand: 'Lenovo', email: 'buyer@example.com', shipTo }),
}), env, fetchImpl)
assert.equal(order.status, 200)
assert.equal((await order.json()).amount, '280.00')

const disabledTestOrder = await handlePayPalCreateOrder(new Request('https://example.test/api/paypal/create-order', {
  method: 'POST',
  body: JSON.stringify({ brand: 'Lenovo', email: 'buyer@example.com', shipTo, testOrder: true }),
}), env, fetchImpl)
assert.equal(disabledTestOrder.status, 403)
assert.deepEqual(await disabledTestOrder.json(), { ok: false, error: 'test_checkout_disabled' })

const testOrder = await handlePayPalCreateOrder(new Request('https://example.test/api/paypal/create-order', {
  method: 'POST',
  body: JSON.stringify({ brand: 'Lenovo', email: 'buyer@example.com', shipTo, testOrder: true }),
}), { ...env, PAYPAL_TEST_CHECKOUT_ENABLED: 'true' }, fetchImpl)
assert.equal(testOrder.status, 200)
const testOrderBody = await testOrder.json()
assert.equal(testOrderBody.amount, '1.00')
assert.equal(testOrderBody.testOrder, true)

const blockedCapture = await handlePayPalCaptureOrder(new Request('https://example.test/api/paypal/capture-order', {
  method: 'POST',
  body: JSON.stringify({ orderId: 'ORDER123456789' }),
}), {
  PAYPAL_CLIENT_ID: env.PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET: env.PAYPAL_CLIENT_SECRET,
  PAYPAL_ENVIRONMENT: 'live',
  PAYPAL_WEBHOOK_ID: env.PAYPAL_WEBHOOK_ID,
}, fetchImpl)
assert.equal(blockedCapture.status, 503)
assert.deepEqual(await blockedCapture.json(), { ok: false, error: 'notifications_not_configured' })

const captured = await handlePayPalCaptureOrder(new Request('https://example.test/api/paypal/capture-order', {
  method: 'POST',
  body: JSON.stringify({ orderId: 'ORDER123456789' }),
}), env, fetchImpl)
assert.equal(captured.status, 200)
assert.deepEqual(await captured.json(), { ok: true, orderId: 'ORDER123456789', status: 'COMPLETED', ownerNotified: true, buyerConfirmed: true })

const first = await handlePayPalWebhook(new Request('https://example.test/api/paypal/webhook', {
  method: 'POST', headers, body: JSON.stringify(event),
}), env, fetchImpl)
assert.equal(first.status, 200)
assert.deepEqual(await first.json(), { ok: true, accepted: true, creates: 0, ownerNotified: false, buyerConfirmed: false, fulfilled: true })

const replay = await handlePayPalWebhook(new Request('https://example.test/api/paypal/webhook', {
  method: 'POST', headers, body: JSON.stringify(event),
}), env, fetchImpl)
assert.equal(replay.status, 200)
assert.deepEqual(await replay.json(), { ok: true, duplicate: true, creates: 0, ownerNotified: false, buyerConfirmed: false })
const sendMailUrl = 'https://graph.microsoft.com/v1.0/users/tgates%40tgttechnologies.com/sendMail'
const sentMail = calls.filter(({ url }) => url === sendMailUrl)
assert.equal(sentMail.length, 2)
assert.equal(sentMail.filter(({ options }) => JSON.parse(options.body).message.toRecipients[0].emailAddress.address === 'tgates@tgttechnologies.com').length, 1)
assert.equal(sentMail.filter(({ options }) => JSON.parse(options.body).message.toRecipients[0].emailAddress.address === 'buyer@example.com').length, 1)
assert.ok(calls.filter(({ url }) => url !== sendMailUrl && !url.includes('/oauth2/v2.0/token')).every(({ url }) => url.startsWith(PAYPAL_LIVE_API)))

const failCalls = []
const failingFetch = async (url, options) => {
  failCalls.push(String(url))
  if (String(url).endsWith('/v2/checkout/orders/ORDERFAIL123456') && options?.method === 'GET') {
    return Response.json({
      id: 'ORDERFAIL123456',
      purchase_units: [{ amount: { currency_code: 'USD', value: '280.00' }, items: [{ name: 'Refurbished Lenovo laptop' }] }],
    })
  }
  if (String(url).endsWith('/v2/checkout/orders/ORDERFAIL123456/capture')) {
    return Response.json({
      ...event.resource,
      id: 'ORDERFAIL123456',
      status: 'COMPLETED',
      supplementary_data: { related_ids: { order_id: 'ORDERFAIL123456' } },
    })
  }
  if (String(url).endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'paypal-token' })
  if (String(url).includes('/oauth2/v2.0/token')) return Response.json({ access_token: 'graph-token' })
  if (String(url).includes('/sendMail')) return Response.json({ error: { code: 'ErrorAccessDenied' } }, { status: 403 })
  throw new Error(`unexpected URL ${url}`)
}
const mailFailed = await handlePayPalCaptureOrder(new Request('https://example.test/api/paypal/capture-order', {
  method: 'POST',
  body: JSON.stringify({ orderId: 'ORDERFAIL123456' }),
}), env, failingFetch)
assert.equal(mailFailed.status, 200)
const mailFailedBody = await mailFailed.json()
assert.equal(mailFailedBody.ok, true)
assert.equal(mailFailedBody.ownerNotified, false)
assert.equal(mailFailedBody.buyerConfirmed, false)
assert.equal(failCalls.filter((url) => url.includes('/capture')).length, 1)
assert.equal(failCalls.filter((url) => url.includes('/sendMail')).length, 2)
const repeat = await handlePayPalCaptureOrder(new Request('https://example.test/api/paypal/capture-order', {
  method: 'POST',
  body: JSON.stringify({ orderId: 'ORDERFAIL123456' }),
}), env, failingFetch)
assert.equal(repeat.status, 200)
assert.equal(failCalls.filter((url) => url.includes('/sendMail')).length, 2)

const invalidFetch = async (url) => url.endsWith('/v1/oauth2/token')
  ? Response.json({ access_token: 'token' })
  : Response.json({ verification_status: 'FAILURE' })
const invalid = await handlePayPalWebhook(new Request('https://example.test/api/paypal/webhook', {
  method: 'POST', headers, body: JSON.stringify({ ...event, id: 'WH-TEST-2' }),
}), env, invalidFetch)
assert.equal(invalid.status, 400)

const tamperCalls = []
const tamperFetch = async (url, options) => {
  tamperCalls.push(`${options?.method || 'GET'} ${url}`)
  if (String(url).endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'paypal-token' })
  if (String(url).endsWith('/v2/checkout/orders/ORDERTAMPER12345') && options?.method === 'GET') {
    return Response.json({
      id: 'ORDERTAMPER12345',
      purchase_units: [{ amount: { currency_code: 'USD', value: '1.00' }, items: [{ name: 'Refurbished Lenovo laptop' }] }],
    })
  }
  throw new Error(`unexpected URL ${url}`)
}
const tampered = await handlePayPalCaptureOrder(new Request('https://example.test/api/paypal/capture-order', {
  method: 'POST',
  body: JSON.stringify({ orderId: 'ORDERTAMPER12345' }),
}), env, tamperFetch)
assert.equal(tampered.status, 409)
assert.deepEqual(await tampered.json(), { ok: false, error: 'amount_not_allowed' })
assert.equal(tamperCalls.some((call) => call.includes('/capture')), false)

function fulfillmentEvent({ id, orderId, productId, value = '280.00', currency = 'USD' }) {
  return {
    id,
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: {
      id: `CAP-${id}`,
      custom_id: productId,
      amount: { currency_code: currency, value },
      payer: { email_address: 'buyer@example.com', name: { given_name: 'Jane', surname: 'Test' } },
      supplementary_data: { related_ids: { order_id: orderId } },
      purchase_units: [{
        custom_id: productId,
        amount: { currency_code: currency, value },
        items: [{ name: 'Refurbished Lenovo laptop', description: 'buyer@example.com' }],
        shipping: event.resource.purchase_units[0].shipping,
      }],
    },
  }
}

function fulfillmentFetch(urls) {
  return async (url) => {
    const href = String(url)
    urls.push(href)
    if (href.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'token' })
    if (href.endsWith('/v1/notifications/verify-webhook-signature')) return Response.json({ verification_status: 'SUCCESS' })
    if (href.includes('/oauth2/v2.0/token')) return Response.json({ access_token: 'graph-token' })
    if (href.includes('/sendMail')) return new Response(null, { status: 202 })
    throw new Error(`unexpected URL ${url}`)
  }
}

async function postWebhook(body, urls) {
  return handlePayPalWebhook(new Request('https://example.test/api/paypal/webhook', {
    method: 'POST', headers, body: JSON.stringify(body),
  }), env, fulfillmentFetch(urls))
}

for (const productId of ['laptop-lenovo', 'laptop-hp', 'laptop-other']) {
  const urls = []
  const suffix = productId.split('-')[1].toUpperCase()
  const response = await postWebhook(fulfillmentEvent({
    id: `WH-VALID-${suffix}`,
    orderId: `ORDERVALID${suffix}1`,
    productId,
  }), urls)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, accepted: true, creates: 0, ownerNotified: true, buyerConfirmed: true, fulfilled: true })
  assert.equal(urls.filter((url) => url.includes('/sendMail')).length, 2)
  console.log(`PASS webhook-fulfillment-${productId}`)
}

const rejected = [
  { id: 'WH-BAD-AMOUNT', orderId: 'ORDERBADAMOUNT01', productId: 'laptop-lenovo', value: '1.00', error: 'amount_not_allowed' },
  { id: 'WH-BAD-CURRENCY', orderId: 'ORDERBADCURR0001', productId: 'laptop-hp', currency: 'EUR', error: 'amount_not_allowed' },
  { id: 'WH-BAD-EBOOK', orderId: 'ORDERBADEBOOK001', productId: 'ebook-ai-made-simple', error: 'product_not_allowed' },
  { id: 'WH-BAD-DOCK', orderId: 'ORDERBADDOCK0001', productId: 'dock', error: 'product_not_allowed' },
  { id: 'WH-BAD-MISSING', orderId: 'ORDERBADMISSING1', productId: '', error: 'product_not_allowed' },
]
for (const item of rejected) {
  const urls = []
  const response = await postWebhook(fulfillmentEvent(item), urls)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, accepted: true, creates: 0, ownerNotified: false, buyerConfirmed: false, fulfilled: false, error: item.error })
  assert.equal(urls.some((url) => url.includes('graph.microsoft.com') || url.includes('/sendMail')), false)
  const replayUrls = []
  const replayResponse = await postWebhook(fulfillmentEvent(item), replayUrls)
  assert.equal(replayResponse.status, 200)
  assert.equal((await replayResponse.json()).duplicate, true)
  assert.equal(replayUrls.some((url) => url.includes('/sendMail')), false)
  console.log(`PASS webhook-rejected-${item.id}`)
}

console.log('PASS: PayPal Live API target, guarded $1 test checkout, capture amount lock, capture notification guard, signature verification, 2xx handling, and replay creates=0')
