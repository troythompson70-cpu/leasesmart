#!/usr/bin/env node
/**
 * Mailbox coverage probe. GET Inbox only. Never POST /api/intake.
 * Never invents GREEN.
 *
 * --loop: serial 60s cycle (wait for tick to finish, then wait 60s).
 * Default: one tick for cron/oneshot.
 *
 * Logs: ~/.tgt-mailbox-coverage/mailbox-coverage.log
 * On HTTP 403: NOT VERIFIED, hold PR #27
 * On HTTP 200: VERIFIED, then promote-on-mailbox-200.sh
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import {
  clearGraphTokenCache,
  mailboxProbeUpn,
  probeMailboxCoverage,
} from '../server/graph-sharepoint.ts'

const INTERVAL_MS = 60_000
const loop = process.argv.includes('--loop')
const STAMP_DIR =
  process.env.TGT_MAILBOX_WATCH_LOG_DIR || path.join(homedir(), '.tgt-mailbox-coverage')

function stamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function httpReason(http) {
  if (http === 200) return 'OK'
  if (http === 401) return 'Unauthorized'
  if (http === 403) return 'Forbidden'
  if (http === 404) return 'Not Found'
  return 'Error'
}

function graphCodeOf(probe) {
  if (probe.graphCode) return probe.graphCode
  const fromDetail = String(probe.detail || '').split(':')[0].trim()
  if (fromDetail) return fromDetail
  if (probe.http === 403) return 'ErrorAccessDenied'
  return 'graph_error'
}

/** @returns {Promise<number>} process exit code for this tick */
async function tick() {
  const upn = mailboxProbeUpn()
  console.log(`[${stamp()}] Executing Inbox GET probe against ${upn}...`)
  try {
    clearGraphTokenCache()
    const probe = await probeMailboxCoverage()
    if (probe.status === 'PASS' && probe.http === 200) {
      console.log(
        `[${stamp()}] Result: 200 OK -> VERIFIED. Triggering promote-on-mailbox-200.sh...`,
      )
      mkdirSync(STAMP_DIR, { recursive: true })
      writeFileSync(path.join(STAMP_DIR, 'VERIFIED-HTTP-200'), `${stamp()}\n`)
      return 0
    }
    if (probe.http === 403) {
      console.log(
        `[${stamp()}] Result: 403 Forbidden (${graphCodeOf(probe)}) -> NOT VERIFIED. Holding PR #27. Sleeping 60s.`,
      )
      return 2
    }
    console.log(
      `[${stamp()}] Result: ${probe.http} ${httpReason(probe.http)} (${graphCodeOf(probe)}) -> NOT VERIFIED. Holding PR #27. Sleeping 60s.`,
    )
    return 3
  } catch (err) {
    const cause = err instanceof Error && 'cause' in err && err.cause instanceof Error ? err.cause : err
    const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : 'error'
    console.log(
      `[${stamp()}] Result: fetch failed (${code}) -> NOT VERIFIED. Holding PR #27. Sleeping 60s.`,
    )
    return 3
  }
}

if (loop) {
  for (;;) {
    const code = await tick()
    if (code === 0) process.exit(0)
    await new Promise((resolve) => {
      setTimeout(resolve, INTERVAL_MS)
    })
  }
} else {
  const code = await tick()
  process.exit(code)
}
