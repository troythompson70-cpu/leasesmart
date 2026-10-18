import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const install = join(here, 'install.sh')
const projectId = 'appgprj_6a8fb5d9596c8191a045ee1e5744fffd'
const route = "    if (url.pathname === '/api/paypal/products') return handlePayPalProducts(request, env)\n"
const worker = `export async function handle(request, env) {
  const url = new URL(request.url)
    if (url.pathname === '/api/paypal/config') return handlePayPalConfig(request, env)
    if (url.pathname === '/api/paypal/create-order') return handlePayPalCreateOrder(request, env)
}
`

function runInstall(root) {
  return spawnSync('bash', [install, root], { encoding: 'utf8' })
}

const refused = runInstall('/workspace')
assert.notEqual(refused.status, 0)
assert.match(`${refused.stderr}\n${refused.stdout}`, /STOP:/)
console.log('PASS packaged-route-refuses-leasesmart')

const wrong = mkdtempSync(join(tmpdir(), 'tgt-wrong-project-'))
try {
  mkdirSync(join(wrong, '.openai'), { recursive: true })
  writeFileSync(join(wrong, '.openai', 'hosting.json'), JSON.stringify({ project_id: 'appgprj_not_tgt' }))
  mkdirSync(join(wrong, 'server'), { recursive: true })
  mkdirSync(join(wrong, 'scripts'), { recursive: true })
  writeFileSync(join(wrong, 'server', 'paypal.js'), 'placeholder\n')
  writeFileSync(join(wrong, 'scripts', 'build-sites-worker.mjs'), worker)
  const result = runInstall(wrong)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /project_id/)
  assert.equal(readFileSync(join(wrong, 'server', 'paypal.js'), 'utf8'), 'placeholder\n')
  console.log('PASS packaged-route-refuses-other-project')
} finally {
  rmSync(wrong, { recursive: true, force: true })
}

const root = mkdtempSync(join(tmpdir(), 'tgt-site-'))
try {
  mkdirSync(join(root, '.openai'), { recursive: true })
  mkdirSync(join(root, 'server'), { recursive: true })
  mkdirSync(join(root, 'scripts'), { recursive: true })
  mkdirSync(join(root, 'src', 'components'), { recursive: true })
  writeFileSync(join(root, '.openai', 'hosting.json'), JSON.stringify({ project_id: projectId }))
  writeFileSync(join(root, 'server', 'paypal.js'), 'placeholder\n')
  writeFileSync(join(root, 'scripts', 'build-sites-worker.mjs'), worker)
  writeFileSync(join(root, 'src', 'components', 'PayPalCheckout.jsx'), 'old cart\n')
  const result = runInstall(root)
  assert.equal(result.status, 0, result.stderr)
  const installed = readFileSync(join(root, 'server', 'paypal.js'), 'utf8')
  assert.match(installed, /webhookCaptureAllowed/)
  assert.match(installed, /laptop-lenovo/)
  assert.match(installed, /laptop-hp/)
  assert.match(installed, /laptop-other/)
  assert.match(installed, /ebook-ai-made-simple/)
  assert.match(installed, /purchasable: false/)
  assert.doesNotMatch(installed, /placeholder/)
  const packaged = readFileSync(join(root, 'scripts', 'build-sites-worker.mjs'), 'utf8')
  assert.ok(packaged.includes(route.trim()))
  assert.ok(packaged.indexOf('/api/paypal/products') > packaged.indexOf('/api/paypal/config'))
  const cart = readFileSync(join(root, 'src', 'components', 'PayPalCheckout.jsx'), 'utf8')
  assert.doesNotMatch(cart, /old cart/)
  assert.match(readFileSync(join(here, 'worker-route.txt'), 'utf8'), /\/api\/paypal\/products/)
  console.log('PASS packaged-route-installs-products-route')
} finally {
  rmSync(root, { recursive: true, force: true })
}

console.log('PASS: packaged route stays on the TGT Website project and does not publish the e-book')
