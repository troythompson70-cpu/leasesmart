/**
 * Packaging regression for Command Center cloud cutover.
 * Does not hit production apex or send mail.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = path.dirname(fileURLToPath(import.meta.url))
const websiteRoot = path.resolve(here, '..')
const repoRoot = path.resolve(websiteRoot, '..')

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`PASS: ${msg}`)
}

const sync = spawnSync(process.execPath, [path.join(here, 'sync-command-center.mjs')], {
  cwd: websiteRoot,
  encoding: 'utf8',
})
assert(sync.status === 0, 'sync-command-center exits 0')

const indexHtml = path.join(websiteRoot, 'public', 'command-center', 'index.html')
assert(existsSync(indexHtml), 'public/command-center/index.html exists after sync')
const html = readFileSync(indexHtml, 'utf8')
assert(html.includes('TGT Revenue Command Center'), 'synced index has RCC title')

const redirects = readFileSync(path.join(websiteRoot, 'public', '_redirects'), 'utf8')
assert(redirects.includes('/command-center'), '_redirects mounts /command-center')
assert(redirects.includes('/api/dashboard-feed'), '_redirects mounts /api/dashboard-feed')
assert(/\/api\/\* \/index\.html 404/.test(redirects), '_redirects keeps API hard-404')

const fn = path.join(websiteRoot, 'netlify', 'functions', 'dashboard-feed.ts')
assert(existsSync(fn), 'netlify/functions/dashboard-feed.ts exists')
const fnSrc = readFileSync(fn, 'utf8')
assert(fnSrc.includes("path: '/api/dashboard-feed'"), 'function path is /api/dashboard-feed')
assert(fnSrc.includes('graphAuthReady'), 'function fail-closes without Graph')

const toml = readFileSync(path.join(repoRoot, 'netlify.toml'), 'utf8')
assert(toml.includes('tgt-website'), 'netlify.toml builds tgt-website')
assert(toml.includes('netlify/functions'), 'netlify.toml registers functions')

console.log('All cc-cutover checks passed.')
