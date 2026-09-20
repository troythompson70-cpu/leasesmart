/**
 * Microsoft Graph SharePoint helpers for TEAM TGT MSP.
 * Secrets stay in process env / gitignored .env. Never log values.
 * Does not mark VERIFIED. Local Vite only — not the public apex.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const GRAPH_ENV_NAMES = [
  'GRAPH_ACCESS_TOKEN',
  'GRAPH_TENANT_ID',
  'GRAPH_CLIENT_ID',
  'GRAPH_CLIENT_SECRET',
  'GRAPH_REFRESH_TOKEN',
] as const

export type GraphEnvName = (typeof GRAPH_ENV_NAMES)[number]

export const CANONICAL_SITE_SEARCH = 'TEAM TGT MSP'
export const CANONICAL_LEAD_INTAKE =
  'General/TGT REVENUE COMMAND CENTER/00 Lead Intake'
export const CANONICAL_DASHBOARD_FEED =
  'General/TGT REVENUE COMMAND CENTER/10 Dashboard Feed'
export const CANONICAL_DASHBOARD_FEED_FILE = 'TGT_DASHBOARD_FEED_2026-09-10.json'

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0'
const LOGIN_ROOT = 'https://login.microsoftonline.com'
const SITE_HOST_CANDIDATES = [
  'tgttechnologies.sharepoint.com',
  'netorgft7859571.sharepoint.com',
]

type TokenCache = { value: string; expiresAt: number }
let tokenCache: TokenCache | null = null
let envLoaded = false

const PLACEHOLDER_RE = /^YOUR_|placeholder|changeme|^example$/i

function envValue(name: GraphEnvName): string {
  const value = String(process.env[name] || '').trim()
  if (!value || PLACEHOLDER_RE.test(value)) return ''
  return value
}

function applyDotEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const raw = trimmed.slice(eq + 1).trim()
    const value = raw.replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

export function loadGraphEnvFromDotEnv(): void {
  if (envLoaded) return
  envLoaded = true
  const here = path.dirname(fileURLToPath(import.meta.url))
  const websiteRoot = path.resolve(here, '..')
  const repoRoot = path.resolve(websiteRoot, '..')
  applyDotEnvFile(path.join(repoRoot, '.env'))
  applyDotEnvFile(path.join(websiteRoot, '.env'))
}

export function listPresentGraphEnvNames(): GraphEnvName[] {
  loadGraphEnvFromDotEnv()
  return GRAPH_ENV_NAMES.filter((name) => envValue(name).length > 0)
}

export function graphAuthReady(): boolean {
  const present = new Set(listPresentGraphEnvNames())
  if (present.has('GRAPH_ACCESS_TOKEN')) return true
  if (present.has('GRAPH_TENANT_ID') && present.has('GRAPH_CLIENT_ID') && present.has('GRAPH_CLIENT_SECRET')) {
    return true
  }
  if (present.has('GRAPH_TENANT_ID') && present.has('GRAPH_CLIENT_ID') && present.has('GRAPH_REFRESH_TOKEN')) {
    return true
  }
  return false
}

export function missingGraphEnv(): GraphEnvName[] {
  if (graphAuthReady()) return []
  return GRAPH_ENV_NAMES.filter((name) => !envValue(name))
}

type GrantKind = 'access_token' | 'refresh_token' | 'client_credentials'

function grantKind(): GrantKind {
  if (envValue('GRAPH_ACCESS_TOKEN')) return 'access_token'
  if (envValue('GRAPH_REFRESH_TOKEN')) return 'refresh_token'
  return 'client_credentials'
}

async function graphAccessToken(): Promise<string> {
  loadGraphEnvFromDotEnv()
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value

  const kind = grantKind()
  switch (kind) {
    case 'access_token': {
      const direct = envValue('GRAPH_ACCESS_TOKEN')
      tokenCache = { value: direct, expiresAt: Date.now() + 10 * 60_000 }
      return direct
    }
    case 'refresh_token':
    case 'client_credentials': {
      const tenant = envValue('GRAPH_TENANT_ID')
      const clientId = envValue('GRAPH_CLIENT_ID')
      const clientSecret = envValue('GRAPH_CLIENT_SECRET')
      const refreshToken = envValue('GRAPH_REFRESH_TOKEN')
      if (!tenant || !clientId) {
        throw new Error('Graph credentials are not configured.')
      }
      const body = new URLSearchParams()
      body.set('client_id', clientId)
      body.set('scope', 'https://graph.microsoft.com/.default')
      if (kind === 'refresh_token') {
        body.set('grant_type', 'refresh_token')
        body.set('refresh_token', refreshToken)
        if (clientSecret) body.set('client_secret', clientSecret)
      } else {
        if (!clientSecret) throw new Error('Graph credentials are not configured.')
        body.set('grant_type', 'client_credentials')
        body.set('client_secret', clientSecret)
      }
      const tokenRes = await fetch(`${LOGIN_ROOT}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      const json = (await tokenRes.json().catch(() => ({}))) as {
        access_token?: string
        expires_in?: number
        error?: string
      }
      if (!tokenRes.ok || !json.access_token) {
        throw new Error(`Graph token request failed (${tokenRes.status}).`)
      }
      tokenCache = {
        value: json.access_token,
        expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000,
      }
      return tokenCache.value
    }
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}

async function graphFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${await graphAccessToken()}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(`${GRAPH_ROOT}${pathname}`, { ...init, headers })
}

type GraphSite = { id?: string; displayName?: string; webUrl?: string; name?: string }

async function resolveTeamTgtMspSite(): Promise<GraphSite | null> {
  const search = await graphFetch(`/sites?search=${encodeURIComponent(CANONICAL_SITE_SEARCH)}`)
  if (search.ok) {
    const payload = (await search.json()) as { value?: GraphSite[] }
    const match = (payload.value || []).find((site) => {
      const blob = `${site.displayName || ''} ${site.name || ''} ${site.webUrl || ''}`
      return /TEAM TGT MSP/i.test(blob)
    })
    if (match?.id) return match
  }

  for (const host of SITE_HOST_CANDIDATES) {
    const encoded = encodeURIComponent(`TEAM TGT MSP`)
    const paths = [
      `/sites/${host}:/sites/${encoded}`,
      `/sites/${host}:/sites/TEAMTGTMSP`,
      `/sites/${host}:/sites/TeamTGTMSP`,
    ]
    for (const p of paths) {
      const res = await graphFetch(p)
      if (!res.ok) continue
      const site = (await res.json()) as GraphSite
      if (site.id) return site
    }
  }
  return null
}

function encodeDrivePath(folderPath: string, fileName?: string): string {
  const parts = folderPath.split('/').filter(Boolean).map(encodeURIComponent)
  if (fileName) parts.push(encodeURIComponent(fileName))
  return parts.join('/')
}

export type GraphItemProof = {
  id: string
  name: string
  webUrl: string
  path: string
}

export async function writeJsonToLeadIntake(input: {
  fileName: string
  body: unknown
}): Promise<GraphItemProof> {
  const site = await resolveTeamTgtMspSite()
  if (!site?.id) {
    throw new Error('TEAM TGT MSP site was not locatable via Graph.')
  }
  const itemPath = encodeDrivePath(CANONICAL_LEAD_INTAKE, input.fileName)
  const res = await graphFetch(`/sites/${site.id}/drive/root:/${itemPath}:/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(input.body),
  })
  if (!res.ok) {
    throw new Error(`SharePoint 00 Lead Intake write failed (HTTP ${res.status}).`)
  }
  const item = (await res.json()) as { id?: string; name?: string; webUrl?: string }
  if (!item.id || !item.name || !item.webUrl) {
    throw new Error('SharePoint write returned no item proof.')
  }
  return {
    id: item.id,
    name: item.name,
    webUrl: item.webUrl,
    path: `${CANONICAL_LEAD_INTAKE}/${item.name}`,
  }
}

export async function readDashboardFeedJson(): Promise<{
  feed: unknown
  name: string
  webUrl: string
  path: string
}> {
  const site = await resolveTeamTgtMspSite()
  if (!site?.id) {
    throw new Error('TEAM TGT MSP site was not locatable via Graph.')
  }
  const itemPath = encodeDrivePath(CANONICAL_DASHBOARD_FEED, CANONICAL_DASHBOARD_FEED_FILE)
  const res = await graphFetch(`/sites/${site.id}/drive/root:/${itemPath}:/content`)
  if (!res.ok) {
    throw new Error(`SharePoint 10 Dashboard Feed cannot be read (HTTP ${res.status}).`)
  }
  const text = await res.text()
  let feed: unknown
  try {
    feed = JSON.parse(text)
  } catch {
    throw new Error('SharePoint 10 Dashboard Feed is not valid JSON.')
  }
  return {
    feed,
    name: CANONICAL_DASHBOARD_FEED_FILE,
    webUrl: '',
    path: `${CANONICAL_DASHBOARD_FEED}/${CANONICAL_DASHBOARD_FEED_FILE}`,
  }
}

export type CoverageProbeCheck = 'mailbox_coverage' | 'app_runtime_record_readback'
export type CoverageProbeStatus = 'PASS' | 'BLOCKED'

export type CoverageProbe = {
  check: CoverageProbeCheck
  status: CoverageProbeStatus
  http: number
  detail: string
}

/** Campaign inbox used for a read-only Graph mailbox GET. Never sends mail. */
const MAILBOX_PROBE_USER = 'info@tgttechnologies.com'

/**
 * Read-only Graph mailbox probe. Does not POST mail or hit production /api/intake.
 * PASS only when Graph returns the Inbox folder. 401/403 is BLOCKED, not GREEN.
 */
export async function probeMailboxCoverage(): Promise<CoverageProbe> {
  if (!graphAuthReady()) {
    return {
      check: 'mailbox_coverage',
      status: 'BLOCKED',
      http: 0,
      detail: 'MISSING_GRAPH_SECRETS',
    }
  }
  const res = await graphFetch(
    `/users/${encodeURIComponent(MAILBOX_PROBE_USER)}/mailFolders/inbox?$select=id,displayName,totalItemCount`,
  )
  if (res.ok) {
    return {
      check: 'mailbox_coverage',
      status: 'PASS',
      http: res.status,
      detail: `Inbox folder readable for ${MAILBOX_PROBE_USER} (GET only).`,
    }
  }
  const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
  const code = body.error?.code || 'graph_error'
  return {
    check: 'mailbox_coverage',
    status: 'BLOCKED',
    http: res.status,
    detail: `${code}: Graph Mail.Read is not granted or the mailbox is not reachable. No mail was sent.`,
  }
}

/**
 * Graph read-back of Command Center SoT files (dashboard feed + 00 Lead Intake listing).
 * This is not TGT OS AppDeploy auth. PASS only on HTTP 200 item reads.
 */
export async function probeAppRuntimeRecordReadback(): Promise<CoverageProbe> {
  if (!graphAuthReady()) {
    return {
      check: 'app_runtime_record_readback',
      status: 'BLOCKED',
      http: 0,
      detail: 'MISSING_GRAPH_SECRETS',
    }
  }
  try {
    const live = await readDashboardFeedJson()
    const site = await resolveTeamTgtMspSite()
    if (!site?.id) {
      return {
        check: 'app_runtime_record_readback',
        status: 'BLOCKED',
        http: 404,
        detail: 'TEAM TGT MSP site was not locatable via Graph.',
      }
    }
    const folderPath = encodeDrivePath(CANONICAL_LEAD_INTAKE)
    const list = await graphFetch(`/sites/${site.id}/drive/root:/${folderPath}:/children?$select=id,name&$top=5`)
    if (!list.ok) {
      return {
        check: 'app_runtime_record_readback',
        status: 'BLOCKED',
        http: list.status,
        detail: `00 Lead Intake listing failed (HTTP ${list.status}).`,
      }
    }
    const payload = (await list.json()) as { value?: Array<{ name?: string }> }
    const count = (payload.value || []).length
    return {
      check: 'app_runtime_record_readback',
      status: 'PASS',
      http: 200,
      detail: `Graph read-back of ${live.name} plus 00 Lead Intake (${count} items). Not TGT OS AppDeploy.`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      check: 'app_runtime_record_readback',
      status: 'BLOCKED',
      http: 503,
      detail: message,
    }
  }
}
