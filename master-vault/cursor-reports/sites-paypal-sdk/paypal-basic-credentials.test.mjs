import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function paypalBasicCredentials(env) {
  const clientId = String(env?.PAYPAL_CLIENT_ID || '').trim()
  const clientSecret = String(env?.PAYPAL_CLIENT_SECRET || '').trim()
  if (!clientId || !clientSecret) throw new Error('paypal_auth_failed')
  return btoa(`${clientId}:${clientSecret}`)
}

const encoded = paypalBasicCredentials({
  PAYPAL_CLIENT_ID: '  live-client-id\n',
  PAYPAL_CLIENT_SECRET: ' live-client-secret\r\n',
})
assert.equal(Buffer.from(encoded, 'base64').toString(), 'live-client-id:live-client-secret')

assert.throws(() => paypalBasicCredentials({ PAYPAL_CLIENT_ID: '  ', PAYPAL_CLIENT_SECRET: 'secret' }), /paypal_auth_failed/)

const patch = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'access-token-trim.patch'), 'utf8')
assert.match(patch, /function paypalBasicCredentials\(env\)/)
assert.match(patch, /\+  const credentials = paypalBasicCredentials\(env\)/)

const checkout = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'PayPalCheckout.jsx'), 'utf8')
assert.doesNotMatch(checkout, /actions\.order\.create/)
assert.doesNotMatch(checkout, /actions\.order\.capture/)
assert.match(checkout, /\/api\/paypal\/create-order/)
assert.match(checkout, /\/api\/paypal\/capture-order/)

console.log('PASS paypal-basic-credentials')
