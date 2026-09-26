/**
 * One-time device-code sign-in for the local Command Center helper.
 * Prints only the URL and the short code. Never prints tokens.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TENANT = 'tgttechnologies.com'
const CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e'
const SCOPE = 'Files.Read.All Sites.Read.All offline_access'
const LOGIN = 'https://login.microsoftonline.com'

function aadsts(text) {
  const match = String(text || '').match(/AADSTS\d+/)
  return match ? match[0] : ''
}

function fail(json, status) {
  const description = String(json.error_description || json.error || '')
  const code = aadsts(description) || String(json.error || `HTTP ${status}`)
  console.error(code)
  if (description && description !== code) console.error(description)
  process.exit(1)
}

function writeEnvLocal(refreshToken) {
  const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const filePath = path.join(websiteRoot, '.env.local')
  const updates = {
    GRAPH_TENANT_ID: TENANT,
    GRAPH_CLIENT_ID: CLIENT_ID,
    GRAPH_REFRESH_TOKEN: refreshToken,
  }
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8').split(/\r?\n/) : []
  const keys = new Set(Object.keys(updates))
  const kept = existing.filter((line) => {
    const key = line.split('=')[0]
    return !keys.has(key)
  })
  while (kept.length && kept[kept.length - 1] === '') kept.pop()
  for (const [key, value] of Object.entries(updates)) {
    kept.push(`${key}=${value}`)
  }
  writeFileSync(filePath, `${kept.join('\n')}\n`, { mode: 0o600 })
  console.log('Saved sign-in to tgt-website/.env.local')
}

async function poll(deviceCode, intervalSec, expiresIn) {
  const deadline = Date.now() + Number(expiresIn || 900) * 1000
  let waitMs = Math.max(1, Number(intervalSec || 5)) * 1000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, waitMs))
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: CLIENT_ID,
      device_code: deviceCode,
    })
    const res = await fetch(`${LOGIN}/${encodeURIComponent(TENANT)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.refresh_token) return json.refresh_token
    const error = String(json.error || '')
    if (error === 'authorization_pending') continue
    if (error === 'slow_down') {
      waitMs += 5000
      continue
    }
    fail(json, res.status)
  }
  console.error('Device code expired before sign-in finished.')
  process.exit(1)
}

async function main() {
  const body = new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE })
  const res = await fetch(`${LOGIN}/${encodeURIComponent(TENANT)}/oauth2/v2.0/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.user_code || !json.device_code) fail(json, res.status)
  console.log(json.verification_uri || 'https://microsoft.com/devicelogin')
  console.log(json.user_code)
  const refreshToken = await poll(json.device_code, json.interval, json.expires_in)
  writeEnvLocal(refreshToken)
}

main().catch((err) => {
  const message = err && err.message ? err.message : String(err)
  console.error(aadsts(message) || message)
  process.exit(1)
})
