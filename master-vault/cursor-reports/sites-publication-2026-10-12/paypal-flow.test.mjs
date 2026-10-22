import assert from 'node:assert/strict'
import { handlePayPalCaptureOrder, handlePayPalCreateOrder, handlePayPalProducts } from './paypal.js'

const sandboxEnv = {
  PAYPAL_ENV: 'sandbox',
  PAYPAL_CLIENT_ID: '  sandbox-client-id\n',
  PAYPAL_CLIENT_SECRET: ' sandbox-client-secret\r\n',
  PAYPAL_WEBHOOK_ID: 'webhook-id',
  MS_TENANT_ID: 'tenant',
  MS_CLIENT_ID: 'ms-id',
  MS_CLIENT_SECRET: 'ms-secret',
  MAIL_SENDER: 'billing@tgttechnologies.com',
  OWNER_EMAIL: 'tgates@tgttechnologies.com',
}

const shipTo = { name: 'Troy Gates', line1: '123 Main Street', city: 'Troy', state: 'mi', postalCode: '48083', country: 'US' }

function orderRequest(body) {
  return new Request('https://tgttechnologies.com/api/paypal/create-order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ brand: 'Lenovo', email: 'buyer@example.com', shipTo, ...body }),
  })
}

function captureRequest(orderId) {
  return new Request('https://tgttechnologies.com/api/paypal/capture-order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId }),
  })
}

function paypalMock({ capturedValue = '280.00', productId = 'laptop-lenovo', itemName = 'Refurbished Lenovo laptop' } = {}) {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options })
    const href = String(url)
    if (href.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'sandbox-token' })
    if (href.endsWith('/v2/checkout/orders')) {
      return Response.json({
        id: '5O190127TN364715T',
        status: 'CREATED',
        links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T' }],
      }, { status: 201 })
    }
    if (href.endsWith('/capture')) {
      return Response.json({
        id: '5O190127TN364715T',
        status: 'COMPLETED',
        payer: { email_address: 'buyer@example.com' },
        purchase_units: [{
          custom_id: productId,
          description: itemName,
          items: [{ name: itemName, description: 'buyer@example.com' }],
          payments: { captures: [{ amount: { currency_code: 'USD', value: capturedValue }, status: 'COMPLETED' }] },
        }],
      })
    }
    if (/\/v2\/checkout\/orders\/[A-Z0-9]+$/.test(href)) {
      return Response.json({
        id: '5O190127TN364715T',
        status: 'APPROVED',
        purchase_units: [{
          custom_id: productId,
          amount: { currency_code: 'USD', value: capturedValue },
          items: [{ name: itemName }],
        }],
      })
    }
    if (href.includes('login.microsoftonline.com')) return Response.json({ access_token: 'graph-token' })
    if (href.includes('graph.microsoft.com') && href.endsWith('/sendMail')) return new Response(null, { status: 202 })
    throw new Error(`unexpected ${href}`)
  }
  return { calls, fetchImpl }
}

const blocked = paypalMock()
const blockedResponse = await handlePayPalCreateOrder(orderRequest({ amount: '1.00' }), sandboxEnv, blocked.fetchImpl)
const blockedBody = await blockedResponse.json()
assert.equal(blockedResponse.status, 409)
assert.equal(blockedBody.error, 'amount_not_allowed')
assert.equal(blocked.calls.length, 0)
console.log('PASS client-1.00-rejected-before-paypal')

const created = paypalMock()
const createResponse = await handlePayPalCreateOrder(orderRequest({ productId: 'laptop-lenovo', amount: '280.00' }), sandboxEnv, created.fetchImpl)
const createBody = await createResponse.json()
assert.equal(createResponse.status, 200)
assert.equal(createBody.amount, '280.00')
assert.match(createBody.approveUrl, /^https:\/\/www\.sandbox\.paypal\.com\/checkoutnow/)
const orderCall = created.calls.find((call) => call.url.endsWith('/v2/checkout/orders'))
assert.match(orderCall.url, /^https:\/\/api-m\.sandbox\.paypal\.com\//)
const orderPayload = JSON.parse(orderCall.options.body)
assert.equal(orderPayload.purchase_units[0].amount.value, '280.00')
assert.equal(orderPayload.purchase_units[0].custom_id, 'laptop-lenovo')
const basic = Buffer.from(created.calls[0].options.headers.authorization.replace('Basic ', ''), 'base64').toString()
assert.equal(basic, 'sandbox-client-id:sandbox-client-secret')
console.log('PASS sandbox-shaped-create-280.00')

const captured = paypalMock()
const captureResponse = await handlePayPalCaptureOrder(captureRequest('5O190127TN364715T'), sandboxEnv, captured.fetchImpl)
const captureBody = await captureResponse.json()
assert.equal(captureResponse.status, 200)
assert.equal(captureBody.status, 'COMPLETED')
assert.equal(captured.calls.some((call) => call.url.endsWith('/capture')), true)
console.log('PASS sandbox-shaped-capture-280.00')

const forged = paypalMock({ capturedValue: '1.00' })
const forgedResponse = await handlePayPalCaptureOrder(captureRequest('5O190127TN364715U'), sandboxEnv, forged.fetchImpl)
const forgedBody = await forgedResponse.json()
assert.equal(forgedResponse.status, 409)
assert.equal(forgedBody.error, 'amount_not_allowed')
assert.equal(forged.calls.some((call) => call.url.endsWith('/capture')), false)
assert.equal(forged.calls.some((call) => String(call.url).includes('graph.microsoft.com')), false)
console.log('PASS forged-1.00-capture-stopped-before-mail')

const ebook = paypalMock()
const ebookResponse = await handlePayPalCreateOrder(orderRequest({ productId: 'ebook-ai-made-simple', brand: 'Lenovo' }), sandboxEnv, ebook.fetchImpl)
const ebookBody = await ebookResponse.json()
assert.equal(ebookResponse.status, 403)
assert.equal(ebookBody.error, 'product_unavailable')
assert.equal(ebook.calls.length, 0)
console.log('PASS ebook-not-for-sale')

const productsResponse = await handlePayPalProducts(new Request('https://tgttechnologies.com/api/paypal/products'), sandboxEnv)
const productsBody = await productsResponse.json()
assert.equal(productsBody.products.some((product) => product.id === 'ebook-ai-made-simple'), false)
assert.equal(productsBody.products.find((product) => product.id === 'laptop-lenovo').amount, '280.00')
console.log('PASS product-list-hides-ebook')

const expandedEnv = {
  ...sandboxEnv,
  PRODUCT_CATALOG: JSON.stringify([
    { id: 'laptop-lenovo', brand: 'Lenovo', name: 'Refurbished Lenovo laptop', amount: '280.00', currency: 'USD', purchasable: true },
    { id: 'dock', name: 'USB-C dock', amount: '49.00', currency: 'USD', purchasable: true },
    { id: 'hidden-case', name: 'Hidden case', amount: '15.00', currency: 'USD', hidden: true },
  ]),
}
const dock = paypalMock({ capturedValue: '49.00', productId: 'dock', itemName: 'USB-C dock' })
const dockResponse = await handlePayPalCreateOrder(orderRequest({ productId: 'dock', amount: '10.00', brand: 'Lenovo' }), expandedEnv, dock.fetchImpl)
assert.equal(dockResponse.status, 409)
const dockOk = paypalMock({ capturedValue: '49.00', productId: 'dock', itemName: 'USB-C dock' })
const dockOkResponse = await handlePayPalCreateOrder(orderRequest({ productId: 'dock', brand: '' }), expandedEnv, dockOk.fetchImpl)
const dockOkBody = await dockOkResponse.json()
assert.equal(dockOkResponse.status, 200)
assert.equal(dockOkBody.amount, '49.00')
const hidden = paypalMock()
const hiddenResponse = await handlePayPalCreateOrder(orderRequest({ productId: 'hidden-case' }), expandedEnv, hidden.fetchImpl)
assert.equal(hiddenResponse.status, 403)
console.log('PASS catalog-price-and-hidden-product')
