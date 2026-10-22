/**
 * T7: laptop checkout flag defaults off.
 * Does not call PayPal or production.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isCartPath, laptopCheckoutEnabled } from '../src/lib/site-flags.ts'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'src')

function pass(name) {
  console.log(`PASS ${name}`)
}

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

assert.equal(laptopCheckoutEnabled, false)
assert.equal(isCartPath('/cart'), true)
assert.equal(isCartPath('/cart/'), true)
assert.equal(isCartPath('/'), false)
assert.equal(isCartPath('/laptop'), false)
pass('laptop checkout flag is off and only /cart is the cart path')

const files = walk(srcDir)
const cartNav = []
const paypalButton = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  if (text.includes('href="/cart"') || text.includes("href='/cart'")) {
    cartNav.push(path.relative(root, file))
  }
  if (/Pay with PayPal|Pay \$280\.00 with PayPal/i.test(text)) {
    paypalButton.push(path.relative(root, file))
  }
}
assert.deepEqual(cartNav, [])
assert.deepEqual(paypalButton, [])
pass('site source has no /cart navigation link and no PayPal button label')

const app = readFileSync(path.join(srcDir, 'App.tsx'), 'utf8')
assert.match(app, /cartPath && !laptopCheckoutEnabled/)
assert.match(app, /<CartClosed \/>/)
const closed = readFileSync(path.join(srcDir, 'components/CartClosed.tsx'), 'utf8')
assert.doesNotMatch(closed, /paypal/i)
assert.doesNotMatch(closed, /<form/i)
pass('direct /cart renders the closed page with no payment form')

console.log('All laptop checkout hide checks passed.')
