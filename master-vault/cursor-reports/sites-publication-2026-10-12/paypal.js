const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com'
const PAYPAL_LIVE_API = 'https://api-m.paypal.com'
const ALLOWED_EVENTS = new Set([
  'CHECKOUT.ORDER.APPROVED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.REFUNDED',
])
const processedEvents = new Map()
const CHECKOUT_PRICE = '280.00'
const TEST_CHECKOUT_PRICE = '1.00'
const CHECKOUT_CURRENCY = 'USD'
const OWNER_EMAIL = 'tgates@tgttechnologies.com'
const LAPTOP_BRANDS = new Set(['Lenovo', 'HP', 'Other'])
const noticedOrders = new Set()

const jsonResponse = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
})

function configured(env) {
  return Boolean(env?.PAYPAL_CLIENT_ID && env?.PAYPAL_CLIENT_SECRET && env?.PAYPAL_WEBHOOK_ID)
}

function notificationsConfigured(env) {
  return Boolean(
    env?.MS_TENANT_ID &&
    env?.MS_CLIENT_ID &&
    env?.MS_CLIENT_SECRET &&
    env?.MAIL_SENDER &&
    env?.OWNER_EMAIL === OWNER_EMAIL
  )
}

function paypalApi(env) {
  return (env?.PAYPAL_ENV || env?.PAYPAL_ENVIRONMENT) === 'live' ? PAYPAL_LIVE_API : PAYPAL_SANDBOX_API
}

function testCheckoutEnabled(env) {
  return env?.PAYPAL_TEST_CHECKOUT_ENABLED === 'true'
}

const DEFAULT_PRODUCTS = [
  { id: 'laptop-lenovo', brand: 'Lenovo', name: 'Refurbished Lenovo laptop', amount: CHECKOUT_PRICE, currency: CHECKOUT_CURRENCY, hidden: false, purchasable: true },
  { id: 'laptop-hp', brand: 'HP', name: 'Refurbished HP laptop', amount: CHECKOUT_PRICE, currency: CHECKOUT_CURRENCY, hidden: false, purchasable: true },
  { id: 'laptop-other', brand: 'Other', name: 'Refurbished Other laptop', amount: CHECKOUT_PRICE, currency: CHECKOUT_CURRENCY, hidden: false, purchasable: true },
  { id: 'ebook-ai-made-simple', brand: '', name: 'AI Made Simple', amount: null, currency: CHECKOUT_CURRENCY, hidden: true, purchasable: false },
]

function moneyAmount(value) {
  return /^\d+\.\d{2}$/.test(String(value || '')) && value !== '0.00'
}

function normalizeProduct(item) {
  if (!item || typeof item.id !== 'string' || !item.id.trim()) return null
  const hidden = item.hidden === true || item.purchasable === false
  const brand = clean(item.brand, 20)
  const name = clean(item.name, 80)
  if (!name) return null
  if (hidden) return { id: item.id.trim(), brand, name, amount: null, currency: CHECKOUT_CURRENCY, hidden: true, purchasable: false }
  if (!moneyAmount(item.amount) || (item.currency && item.currency !== CHECKOUT_CURRENCY)) return null
  return { id: item.id.trim(), brand, name, amount: item.amount, currency: CHECKOUT_CURRENCY, hidden: false, purchasable: true }
}

export function catalogProducts(env) {
  if (env?.PRODUCT_CATALOG == null || env.PRODUCT_CATALOG === '') return DEFAULT_PRODUCTS.map((item) => ({ ...item }))
  let parsed
  try {
    parsed = JSON.parse(env.PRODUCT_CATALOG)
  } catch {
    return { error: 'catalog_invalid', status: 500 }
  }
  if (!Array.isArray(parsed)) return { error: 'catalog_invalid', status: 500 }
  const products = []
  for (const item of parsed) {
    const product = normalizeProduct(item)
    if (!product) return { error: 'catalog_invalid', status: 500 }
    products.push(product)
  }
  return products
}

function findPurchasable(products, key) {
  return products.find((product) => product.purchasable && (product.id === key || product.brand === key)) || null
}

export function resolveCheckout(body, env) {
  const products = catalogProducts(env)
  if (products.error) return products
  let product
  if (body?.productId) {
    product = products.find((item) => item.id === body.productId) || null
    if (!product || !product.purchasable) return { error: 'product_unavailable', status: 403 }
  } else {
    const brand = readBrand(body)
    if (!brand) return { error: 'brand_required', status: 400 }
    product = findPurchasable(products, brand)
    if (!product) return { error: 'product_unavailable', status: 403 }
  }
  let amount = product.amount
  if (body?.testOrder === true) {
    if (!testCheckoutEnabled(env)) return { error: 'test_checkout_disabled', status: 403 }
    amount = TEST_CHECKOUT_PRICE
  }
  if (body?.amount != null && body.amount !== '' && String(body.amount) !== amount) return { error: 'amount_not_allowed', status: 409 }
  return { product, amount, brand: product.brand || product.id, name: product.name }
}

function orderAmountAllowed(order, env) {
  const unit = Array.isArray(order?.purchase_units) ? order.purchase_units[0] : null
  const value = unit?.amount?.value
  const currency = unit?.amount?.currency_code
  if (currency !== CHECKOUT_CURRENCY) return false
  if (value === CHECKOUT_PRICE) return true
  if (value === TEST_CHECKOUT_PRICE) return testCheckoutEnabled(env) && String(unit?.items?.[0]?.name || '').includes('TGT TEST ORDER')
  const products = catalogProducts(env)
  if (products.error) return false
  const product = findPurchasable(products, unit?.custom_id)
  return Boolean(product && product.amount === value)
}

function checkoutItemName(brand, amount) {
  return amount === TEST_CHECKOUT_PRICE ? 'TGT TEST ORDER - DO NOT SHIP' : `Refurbished ${brand} laptop`
}

function checkoutDescription(brand, amount) {
  return amount === TEST_CHECKOUT_PRICE ? 'TGT TEST ORDER - DO NOT SHIP - PayPal live checkout verification' : `Refurbished ${brand} laptop, 90-day hardware warranty`
}

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function readBuyerEmail(body) {
  const email = clean(body?.email, 120).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export function readBrand(body) {
  const brand = clean(body?.brand, 20)
  return LAPTOP_BRANDS.has(brand) ? brand : null
}

export function readShipping(body) {
  const shipTo = body?.shipTo || {}
  const name = clean(shipTo.name, 80)
  const line1 = clean(shipTo.line1, 80)
  const line2 = clean(shipTo.line2, 80)
  const city = clean(shipTo.city, 60)
  const state = clean(shipTo.state, 2).toUpperCase()
  const postalCode = clean(shipTo.postalCode, 10)
  const country = clean(shipTo.country || 'US', 2).toUpperCase()
  if (name.length < 2 || line1.length < 4 || city.length < 2) return null
  if (!/^[A-Z]{2}$/.test(state) || !/^\d{5}(-\d{4})?$/.test(postalCode) || country !== 'US') return null
  return { name, line1, line2, city, state, postalCode, country }
}

function paypalShipping(shipping) {
  const address = {
    address_line_1: shipping.line1,
    admin_area_2: shipping.city,
    admin_area_1: shipping.state,
    postal_code: shipping.postalCode,
    country_code: shipping.country,
  }
  if (shipping.line2) address.address_line_2 = shipping.line2
  return { name: { full_name: shipping.name }, address }
}

function emailFromPayPal(result) {
  const unit = Array.isArray(result?.purchase_units) ? result.purchase_units[0] : null
  const described = clean(unit?.items?.[0]?.description, 120).toLowerCase()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(described)) return described
  const payer = clean(result?.payer?.email_address, 120).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer) ? payer : ''
}

function amountFromPayPal(result) {
  const unit = Array.isArray(result?.purchase_units) ? result.purchase_units[0] : null
  const amount = unit?.payments?.captures?.[0]?.amount || unit?.amount
  const value = clean(amount?.value, 20) || CHECKOUT_PRICE
  const currency = clean(amount?.currency_code, 3) || CHECKOUT_CURRENCY
  return `$${value} ${currency}`
}

function detailsText(capture, shipping, brand) {
  const cityLine = [shipping?.city, shipping?.state, shipping?.postalCode].filter(Boolean).join(', ')
  const testOrder = brandFromPayPal(capture) === 'Test'
  return [
    `Brand: ${brand}`,
    testOrder ? 'Item: TGT TEST ORDER - DO NOT SHIP' : 'Item: Refurbished laptop',
    testOrder ? 'Warranty: Not applicable - test order' : 'Warranty: 90-day hardware',
    `Amount: ${amountFromPayPal(capture)}`, 
    `Order: ${paypalOrderId(capture)}`,
    `Email: ${emailFromPayPal(capture) || 'Email not provided'}`,
    'Ship to:',
    shipping?.name || 'Name not provided',
    shipping?.line1 || 'Street not provided',
    shipping?.line2,
    cityLine || 'City not provided',
    shipping?.country,
  ].filter(Boolean)
}

function brandFromPayPal(result) {
  const unit = Array.isArray(result?.purchase_units) ? result.purchase_units[0] : null
  const name = `${unit?.items?.[0]?.name || ''} ${unit?.description || ''} ${result?.description || ''}`
  if (name.includes('TGT TEST ORDER')) return 'Test'
  if (name.includes('Lenovo')) return 'Lenovo'
  if (name.includes('HP')) return 'HP'
  if (name.includes('Other')) return 'Other'
  return ''
}

function shippingFromPayPal(result) {
  const unit = Array.isArray(result?.purchase_units) ? result.purchase_units[0] : null
  const shipping = unit?.shipping || result?.shipping
  const address = shipping?.address
  if (!address?.address_line_1) return null
  return {
    name: clean(shipping?.name?.full_name, 80),
    line1: clean(address.address_line_1, 80),
    line2: clean(address.address_line_2, 80),
    city: clean(address.admin_area_2, 60),
    state: clean(address.admin_area_1, 2).toUpperCase(),
    postalCode: clean(address.postal_code, 10),
    country: clean(address.country_code, 2).toUpperCase(),
  }
}

export function ownerPurchaseNotice(capture, fallbackShipping) {
  const payer = capture?.payer || {}
  const buyerName = [payer.name?.given_name, payer.name?.surname].filter(Boolean).join(' ')
  const shipping = shippingFromPayPal(capture) || fallbackShipping || null
  const brand = brandFromPayPal(capture) || 'Not recorded'
  const text = [
    'Laptop purchase paid. This notice goes only to TGT.',
    `Buyer: ${buyerName || 'Name not provided'}`,
    ...detailsText(capture, shipping, brand),
    'Reply from the buyer comes back to this mailbox. Correct the ship-to before the laptop leaves.',
  ].join('\n')
  const orderId = paypalOrderId(capture)
  return {
    to: [OWNER_EMAIL],
    orderId,
    subject: `TGT laptop to ship ${orderId}`.trim(),
    text,
    shipTo: shipping,
  }
}

export function buyerConfirmation(capture, fallbackShipping) {
  const email = emailFromPayPal(capture)
  if (!email) return null
  const shipping = shippingFromPayPal(capture) || fallbackShipping || null
  const brand = brandFromPayPal(capture) || 'Not recorded'
  const text = [
    'Your TGT laptop order is paid. Please check every line.',
    ...detailsText(capture, shipping, brand),
    'If any line is wrong, reply to this email before the laptop ships. TGT will correct it.',
    'Questions: info@tgttechnologies.com',
  ].join('\n')
  const orderId = paypalOrderId(capture)
  return {
    to: [email],
    orderId,
    subject: `Confirm your TGT laptop order ${orderId}`.trim(),
    text,
  }
}

function paypalOrderId(result) {
  return clean(result?.supplementary_data?.related_ids?.order_id || result?.id, 40)
}

function logMailFailure(orderId, err) {
  console.error(JSON.stringify({
    orderId: clean(orderId, 40),
    error: clean(err?.code || err?.message || 'mail_failed', 80),
    status: Number(err?.status) || 0,
  }))
}

async function graphToken(env, fetchImpl) {
  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    client_secret: env.MS_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  })
  const response = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(env.MS_TENANT_ID)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.access_token) {
    const err = new Error('graph_token_failed')
    err.status = response.status
    err.code = payload?.error || 'graph_token_failed'
    err.description = String(payload?.error_description || '')
    throw err
  }
  return payload.access_token
}

async function sendMail(env, notice, fetchImpl) {
  const token = await graphToken(env, fetchImpl)
  const response = await fetchImpl(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env.MAIL_SENDER)}/sendMail`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: notice.subject,
        body: { contentType: 'Text', content: notice.text },
        toRecipients: [{ emailAddress: { address: notice.to[0] } }],
        replyTo: [{ emailAddress: { address: 'info@tgttechnologies.com' } }],
      },
      saveToSentItems: true,
    }),
  })
  if (response.status !== 202) {
    const payload = await response.json().catch(() => null)
    const err = new Error('graph_send_failed')
    err.status = response.status
    err.code = payload?.error?.code || 'graph_send_failed'
    throw err
  }
}

async function postNotice(env, notice, dedupeKey, orderId, fetchImpl) {
  if (!Array.isArray(notice?.to) || notice.to.length !== 1) return { delivered: false, reason: 'one_recipient' }
  if (noticedOrders.has(dedupeKey)) return { delivered: false, reason: 'duplicate' }
  noticedOrders.add(dedupeKey)
  try {
    await sendMail(env, notice, fetchImpl)
    return { delivered: true }
  } catch (err) {
    logMailFailure(orderId, err)
    return { delivered: false, reason: 'notify_failed', status: Number(err?.status) || 0 }
  }
}

async function deliverOwnerNotice(env, notice, fetchImpl) {
  const orderId = notice.orderId
  if (!Array.isArray(notice.to) || notice.to.length !== 1 || notice.to[0] !== OWNER_EMAIL) {
    return { delivered: false, reason: 'owner_only' }
  }
  return postNotice(env, notice, `owner:${orderId}`, orderId, fetchImpl)
}

async function deliverBuyerConfirmation(env, notice, fetchImpl) {
  if (!notice || notice.to.length !== 1) return { delivered: false, reason: 'buyer_only' }
  return postNotice(env, notice, `buyer:${notice.orderId}`, notice.orderId, fetchImpl)
}

function paypalBasicCredentials(env) {
  const clientId = String(env?.PAYPAL_CLIENT_ID || '').trim()
  const clientSecret = String(env?.PAYPAL_CLIENT_SECRET || '').trim()
  if (!clientId || !clientSecret) throw new Error('paypal_auth_failed')
  return btoa(`${clientId}:${clientSecret}`)
}

async function accessToken(env, fetchImpl) {
  const credentials = paypalBasicCredentials(env)
  const response = await fetchImpl(`${paypalApi(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${credentials}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.access_token) throw new Error('paypal_auth_failed')
  return body.access_token
}

async function verifyWebhook(request, event, env, fetchImpl) {
  const required = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time']
  if (required.some((header) => !request.headers.get(header))) return false
  const token = await accessToken(env, fetchImpl)
  const response = await fetchImpl(`${paypalApi(env)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      auth_algo: request.headers.get('paypal-auth-algo'),
      cert_url: request.headers.get('paypal-cert-url'),
      transmission_id: request.headers.get('paypal-transmission-id'),
      transmission_sig: request.headers.get('paypal-transmission-sig'),
      transmission_time: request.headers.get('paypal-transmission-time'),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
  })
  const result = await response.json().catch(() => null)
  return response.ok && result?.verification_status === 'SUCCESS'
}

async function paypalRequest(path, env, fetchImpl, options = {}) {
  const token = await accessToken(env, fetchImpl)
  return fetchImpl(`${paypalApi(env)}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  })
}

export async function handlePayPalCreateOrder(request, env, fetchImpl = fetch) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' })
  if (!configured(env)) return jsonResponse({ ok: false, error: 'paypal_not_configured' }, 503)
  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'ship_to_required' }, 400)
  }
  const shipping = readShipping(body)
  const email = readBuyerEmail(body)
  if (!shipping) return jsonResponse({ ok: false, error: 'ship_to_required' }, 400)
  if (!email) return jsonResponse({ ok: false, error: 'email_required' }, 400)
  const resolved = resolveCheckout(body, env)
  if (resolved.error) return jsonResponse({ ok: false, error: resolved.error }, resolved.status)
  const amount = resolved.amount
  const brand = resolved.brand
  const itemName = amount === TEST_CHECKOUT_PRICE ? checkoutItemName(brand, amount) : resolved.name
  const itemDescription = amount === TEST_CHECKOUT_PRICE ? `${email} | TGT TEST ORDER - DO NOT SHIP` : email
  try {
    const response = await paypalRequest('/v2/checkout/orders', env, fetchImpl, {
      method: 'POST',
      headers: { 'paypal-request-id': crypto.randomUUID() },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          description: checkoutDescription(brand, amount),
          custom_id: resolved.product.id,
          amount: {
            currency_code: CHECKOUT_CURRENCY,
            value: amount,
            breakdown: {
              item_total: { currency_code: CHECKOUT_CURRENCY, value: amount },
              shipping: { currency_code: CHECKOUT_CURRENCY, value: '0.00' },
            },
          },
          items: [{
            name: itemName,
            description: itemDescription,
            quantity: '1',
            category: 'PHYSICAL_GOODS',
            unit_amount: { currency_code: CHECKOUT_CURRENCY, value: amount },
          }],
          shipping: paypalShipping(shipping),
        }],
        payment_source: {
          paypal: {
            experience_context: {
              shipping_preference: 'SET_PROVIDED_ADDRESS',
              user_action: 'PAY_NOW',
              return_url: `${new URL(request.url).origin}/cart?paypal=approved`,
              cancel_url: `${new URL(request.url).origin}/cart?paypal=cancelled`,
            },
          },
        },
      }),
    })
    const result = await response.json().catch(() => null)
    const approveUrl = result?.links?.find((link) => link.rel === 'payer-action' || link.rel === 'approve')?.href
    if (!response.ok || !result?.id || !approveUrl) {
      const detail = Array.isArray(result?.details) ? result.details[0] : null
      return jsonResponse({
        ok: false,
        error: 'order_create_failed',
        paypalStatus: response.status,
        paypalName: result?.name || null,
        paypalMessage: result?.message || null,
        paypalIssue: detail?.issue || null,
        paypalDescription: detail?.description || null,
        paypalDebugId: result?.debug_id || null,
      }, 502)
    }
    return jsonResponse({ ok: true, orderId: result.id, approveUrl, amount, currency: CHECKOUT_CURRENCY, status: result.status || null, testOrder: amount === TEST_CHECKOUT_PRICE })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'order_create_failed'
    return jsonResponse({ ok: false, error: message }, 502)
  }
}

export async function handlePayPalCaptureOrder(request, env, fetchImpl = fetch) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' })
  if (!configured(env)) return jsonResponse({ ok: false, error: 'paypal_not_configured' }, 503)
  if (!notificationsConfigured(env)) return jsonResponse({ ok: false, error: 'notifications_not_configured' }, 503)
  let orderId
  try {
    orderId = (await request.json())?.orderId
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_request' }, 400)
  }
  if (!/^[A-Z0-9]{10,30}$/.test(orderId || '')) return jsonResponse({ ok: false, error: 'invalid_request' }, 400)
  try {
    const lookup = await paypalRequest(`/v2/checkout/orders/${orderId}`, env, fetchImpl, { method: 'GET' })
    const order = await lookup.json().catch(() => null)
    if (!lookup.ok || !orderAmountAllowed(order, env)) return jsonResponse({ ok: false, error: 'amount_not_allowed' }, 409)
    const response = await paypalRequest(`/v2/checkout/orders/${orderId}/capture`, env, fetchImpl, { method: 'POST', body: '{}' })
    const result = await response.json().catch(() => null)
    if (!response.ok || result?.status !== 'COMPLETED') return jsonResponse({ ok: false, error: 'capture_failed' }, 502)
    const owner = await deliverOwnerNotice(env, ownerPurchaseNotice(result), fetchImpl)
    const buyer = await deliverBuyerConfirmation(env, buyerConfirmation(result), fetchImpl)
    return jsonResponse({
      ok: true,
      orderId: result.id,
      status: result.status,
      ownerNotified: owner.delivered === true,
      buyerConfirmed: buyer.delivered === true,
    })
  } catch {
    return jsonResponse({ ok: false, error: 'capture_failed' }, 502)
  }
}

export async function handlePayPalWebhook(request, env, fetchImpl = fetch) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' })
  if (!configured(env)) return jsonResponse({ ok: false, error: 'paypal_not_configured' }, 503)
  let event
  try {
    event = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400)
  }
  if (!event?.id || !event?.event_type) return jsonResponse({ ok: false, error: 'invalid_event' }, 400)
  let verified = false
  try {
    verified = await verifyWebhook(request, event, env, fetchImpl)
  } catch {
    return jsonResponse({ ok: false, error: 'verification_unavailable' }, 502)
  }
  if (!verified) return jsonResponse({ ok: false, error: 'invalid_signature' }, 400)
  if (processedEvents.has(event.id)) return jsonResponse({ ok: true, duplicate: true, creates: 0, ownerNotified: false, buyerConfirmed: false }, 200)
  processedEvents.set(event.id, Date.now())
  if (processedEvents.size > 1000) processedEvents.delete(processedEvents.keys().next().value)
  let ownerNotified = false
  let buyerConfirmed = false
  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const resource = event.resource || {}
    ownerNotified = (await deliverOwnerNotice(env, ownerPurchaseNotice(resource), fetchImpl)).delivered === true
    const confirmation = buyerConfirmation(resource)
    if (confirmation) buyerConfirmed = (await deliverBuyerConfirmation(env, confirmation, fetchImpl)).delivered === true
  }
  return jsonResponse({ ok: true, accepted: ALLOWED_EVENTS.has(event.event_type), creates: 0, ownerNotified, buyerConfirmed }, 200)
}

export function handlePayPalProducts(request, env) {
  if (request.method !== 'GET') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'GET' })
  const products = catalogProducts(env)
  if (products.error) return jsonResponse({ ok: false, error: products.error }, products.status)
  return jsonResponse({
    ok: true,
    products: products.filter((product) => product.purchasable && !product.hidden).map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand || null,
      amount: product.amount,
      currency: product.currency,
    })),
  })
}

export function handlePayPalConfig(request, env) {
  if (request.method !== 'GET') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'GET' })
  if (!configured(env)) return jsonResponse({ ok: false, error: 'paypal_not_configured' }, 503)
  const environment = (env?.PAYPAL_ENV || env?.PAYPAL_ENVIRONMENT) === 'live' ? 'live' : 'sandbox'
  return jsonResponse({ clientId: env.PAYPAL_CLIENT_ID, environment, notificationsConfigured: notificationsConfigured(env) }, 200)
}

export { ALLOWED_EVENTS, CHECKOUT_CURRENCY, CHECKOUT_PRICE, TEST_CHECKOUT_PRICE, OWNER_EMAIL, PAYPAL_LIVE_API, PAYPAL_SANDBOX_API }
