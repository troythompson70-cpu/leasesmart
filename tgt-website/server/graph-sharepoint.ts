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
const GRAPH_FETCH_TIMEOUT_MS = 20_000

function graphFetchInit(init: RequestInit = {}): RequestInit {
  if (init.signal) return init
  return { ...init, signal: AbortSignal.timeout(GRAPH_FETCH_TIMEOUT_MS) }
}
const SITE_HOST_CANDIDATES = [
  'tgttechnologies.sharepoint.com',
  'netorgft7859571.sharepoint.com',
]

type TokenCache = { value: string; expiresAt: number }
let tokenCache: TokenCache | null = null
let envLoaded = false

/** Drop cached Graph tokens so a watch loop can request a new client-credentials grant. */
export function clearGraphTokenCache(): void {
  tokenCache = null
}

const PLACEHOLDER_RE = /^YOUR_|placeholder|changeme|^example$/i

function envValue(name: GraphEnvName): string {
  const value = String(process.env[name] || '').trim()
  if (!value || PLACEHOLDER_RE.test(value)) return ''
  return value
}

function applyDotEnvFile(filePath: string, override = false): void {
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
    if (override || !process.env[key]) process.env[key] = value
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
  applyDotEnvFile(path.join(websiteRoot, '.env.local'), true)
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

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length < 2) return {}
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  try {
    return JSON.parse(Buffer.from(pad, 'base64').toString('utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Claims only — never returns the access token value. */
export async function inspectGraphAppTokenClaims(): Promise<{
  grant: GrantKind
  roles: string[]
  scp: string | null
  idtyp: string | null
  appid: string | null
  tid: string | null
  aud: string | null
  mailReadApplication: boolean
}> {
  loadGraphEnvFromDotEnv()
  clearGraphTokenCache()
  const grant = grantKind()
  const token = await graphAccessToken()
  const payload = decodeJwtPayload(token)
  const roles = Array.isArray(payload.roles) ? payload.roles.map((r) => String(r)) : []
  const scp = payload.scp == null ? null : String(payload.scp)
  return {
    grant,
    roles,
    scp,
    idtyp: payload.idtyp == null ? null : String(payload.idtyp),
    appid: payload.appid == null ? null : String(payload.appid),
    tid: payload.tid == null ? null : String(payload.tid),
    aud: payload.aud == null ? null : String(payload.aud),
    mailReadApplication: roles.includes('Mail.Read'),
  }
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
      const deviceCodeClient = clientId === '14d82eec-204b-4c2f-b7e8-296a70dab67e'
      if (kind === 'refresh_token') {
        body.set('grant_type', 'refresh_token')
        body.set('refresh_token', refreshToken)
        if (clientSecret && !deviceCodeClient) {
          body.set('client_secret', clientSecret)
          body.set('scope', 'https://graph.microsoft.com/.default')
        } else {
          body.set(
            'scope',
            'https://graph.microsoft.com/Files.Read.All https://graph.microsoft.com/Sites.Read.All offline_access',
          )
        }
      } else {
        if (!clientSecret) throw new Error('Graph credentials are not configured.')
        body.set('grant_type', 'client_credentials')
        body.set('client_secret', clientSecret)
        body.set('scope', 'https://graph.microsoft.com/.default')
      }
      const tokenRes = await fetch(
        `${LOGIN_ROOT}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
        graphFetchInit({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        }),
      )
      const json = (await tokenRes.json().catch(() => ({}))) as {
        access_token?: string
        expires_in?: number
        error?: string
        error_description?: string
      }
      if (!tokenRes.ok || !json.access_token) {
        const aadsts = String(json.error_description || '').match(/AADSTS\d+/)
        const detail = [json.error, aadsts?.[0]].filter(Boolean).join(' ')
        throw new Error(
          `Graph token request failed (${tokenRes.status})${detail ? `: ${detail}` : ''}.`,
        )
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
  return fetch(`${GRAPH_ROOT}${pathname}`, graphFetchInit({ ...init, headers }))
}

const GRAPH_RESOURCE_APP_ID = '00000003-0000-0000-c000-000000000000'
const KNOWN_GRAPH_APP_ROLES: Record<string, string> = {
  '810c84a8-4a9e-49e6-bf7d-12d183f40d01': 'Mail.Read',
  '6931bccd-447a-43d1-b442-00a1954745bd': 'MailboxSettings.Read',
  '205e70e5-aba6-4c52-a976-6d2d46c48043': 'Sites.Read.All',
  '9492366f-7969-46a4-8d15-ed1a20078fff': 'Sites.ReadWrite.All',
  '9a5d68dd-61b1-44c3-b353-d64dd5032e0b': 'Application.Read.All',
}
const KNOWN_GRAPH_DELEGATED: Record<string, string> = {
  '570282fd-fa5c-430d-a7fd-fc8dc19a8e5a': 'Mail.Read',
}

function nameGraphPermission(kind: 'Role' | 'Scope', id: string): string {
  const table = kind === 'Role' ? KNOWN_GRAPH_APP_ROLES : KNOWN_GRAPH_DELEGATED
  return table[id] || id
}

/** App registration requested permissions. Needs Application.Read.All to succeed. Never logs tokens. */
export async function inspectEntraAppRequestedPermissions(): Promise<{
  http: number
  displayName: string | null
  graphApplication: string[]
  graphDelegated: string[]
  mailReadApplicationRequested: boolean
  mailReadDelegatedRequested: boolean
  detail: string
}> {
  loadGraphEnvFromDotEnv()
  const appId = envValue('GRAPH_CLIENT_ID')
  const res = await graphFetch(
    `/applications?$filter=${encodeURIComponent(`appId eq '${appId}'`)}&$select=id,appId,displayName,requiredResourceAccess`,
  )
  if (!res.ok) {
    return {
      http: res.status,
      displayName: null,
      graphApplication: [],
      graphDelegated: [],
      mailReadApplicationRequested: false,
      mailReadDelegatedRequested: false,
      detail: 'Cannot read app registration (need Application.Read.All consented on this app, or use the Entra blade).',
    }
  }
  const payload = (await res.json()) as {
    value?: Array<{
      displayName?: string
      requiredResourceAccess?: Array<{
        resourceAppId?: string
        resourceAccess?: Array<{ id?: string; type?: string }>
      }>
    }>
  }
  const app = payload.value?.[0]
  const graph = (app?.requiredResourceAccess || []).find((r) => r.resourceAppId === GRAPH_RESOURCE_APP_ID)
  const graphApplication: string[] = []
  const graphDelegated: string[] = []
  for (const entry of graph?.resourceAccess || []) {
    const id = String(entry.id || '')
    const type = String(entry.type || '')
    if (type === 'Role') graphApplication.push(nameGraphPermission('Role', id))
    else if (type === 'Scope') graphDelegated.push(nameGraphPermission('Scope', id))
  }
  return {
    http: res.status,
    displayName: app?.displayName || null,
    graphApplication,
    graphDelegated,
    mailReadApplicationRequested: graphApplication.includes('Mail.Read'),
    mailReadDelegatedRequested: graphDelegated.includes('Mail.Read'),
    detail: 'requiredResourceAccess from this app registration (requested, not the same as JWT roles).',
  }
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

/** PUT the canonical dashboard feed. Does not invent GREEN. */
export async function writeDashboardFeedJson(feed: unknown): Promise<GraphItemProof> {
  const site = await resolveTeamTgtMspSite()
  if (!site?.id) {
    throw new Error('TEAM TGT MSP site was not locatable via Graph.')
  }
  const itemPath = encodeDrivePath(CANONICAL_DASHBOARD_FEED, CANONICAL_DASHBOARD_FEED_FILE)
  const res = await graphFetch(`/sites/${site.id}/drive/root:/${itemPath}:/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(feed, null, 2),
  })
  if (!res.ok) {
    throw new Error(`SharePoint 10 Dashboard Feed write failed (HTTP ${res.status}).`)
  }
  const item = (await res.json()) as { id?: string; name?: string; webUrl?: string }
  if (!item.id || !item.name || !item.webUrl) {
    throw new Error('SharePoint dashboard feed write returned no item proof.')
  }
  return {
    id: item.id,
    name: item.name,
    webUrl: item.webUrl,
    path: `${CANONICAL_DASHBOARD_FEED}/${item.name}`,
  }
}

export type CoverageProbeCheck = 'mailbox_coverage' | 'app_runtime_record_readback'
export type CoverageProbeStatus = 'PASS' | 'BLOCKED'

export type CoverageProbe = {
  check: CoverageProbeCheck
  status: CoverageProbeStatus
  http: number
  detail: string
  graphCode?: string
}

/**
 * Graph mailbox GET must use the mailbox User Principal Name (primary SMTP).
 * `info@tgttechnologies.com` is a secondary alias on this mailbox — Graph
 * `/users/info@...` is not a user resource and returns ErrorAccessDenied.
 * Override with GRAPH_MAILBOX_UPN in .env. Never sends mail.
 */
export const DEFAULT_MAILBOX_PROBE_UPN = 'tgates@tgttechnologies.com'

export function mailboxProbeUpn(): string {
  loadGraphEnvFromDotEnv()
  const fromEnv = String(process.env.GRAPH_MAILBOX_UPN || '').trim()
  if (fromEnv && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEnv) && !PLACEHOLDER_RE.test(fromEnv)) {
    return fromEnv
  }
  return DEFAULT_MAILBOX_PROBE_UPN
}

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
  const upn = mailboxProbeUpn()
  const res = await graphFetch(
    `/users/${encodeURIComponent(upn)}/mailFolders/inbox?$select=id,displayName,totalItemCount`,
  )
  if (res.ok) {
    return {
      check: 'mailbox_coverage',
      status: 'PASS',
      http: res.status,
      detail: `Inbox folder readable for ${upn} (GET only).`,
    }
  }
  const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
  const code = body.error?.code || 'graph_error'
  return {
    check: 'mailbox_coverage',
    status: 'BLOCKED',
    http: res.status,
    graphCode: code,
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
