import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { cycleOverLimit, HELPER_DIR, readHeartbeat } from '../server/helper-heartbeat.ts'
import { watchdogAction } from '../server/helper-watchdog.ts'
import { graphFetch, mailboxUserPath } from '../server/graph-sharepoint.ts'
import { readSystemMode, writeSystemMode } from '../server/system-mode.ts'

const STATE_PATH = join(HELPER_DIR, 'watchdog-state.json')
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const NODE = process.execPath
const CHECK_MS = 60 * 1000

function readState() {
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf8'))
    return { alreadyRestarted: Boolean(parsed.alreadyRestarted), alerted: Boolean(parsed.alerted) }
  } catch {
    return { alreadyRestarted: false, alerted: false }
  }
}

function saveState(state) {
  mkdirSync(HELPER_DIR, { recursive: true, mode: 0o700 })
  writeFileSync(STATE_PATH, JSON.stringify(state), { mode: 0o600 })
}

async function portOpen() {
  try {
    const res = await fetch('http://127.0.0.1:5173/command-center/', { signal: AbortSignal.timeout(3000) })
    return res.status === 200
  } catch {
    return false
  }
}

function restartHelper() {
  const child = spawn(NODE, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  console.log(`[helper-watchdog] restart spawned pid ${child.pid}`)
}

async function alertOnce() {
  const res = await graphFetch(mailboxUserPath('/sendMail'), {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject: 'TGT helper is down',
        body: { contentType: 'Text', content: 'TGT helper is down after one restart.' },
        toRecipients: [{ emailAddress: { address: 'tgates@tgttechnologies.com' } }],
      },
      saveToSentItems: true,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`[helper-watchdog] alert failed (HTTP ${res.status} ${body.slice(0, 160)})`)
    return false
  }
  console.log('[helper-watchdog] alert sent')
  return true
}

async function tick() {
  const open = await portOpen()
  const late = cycleOverLimit(readHeartbeat(), Date.now())
  const state = readState()
  const decision = watchdogAction({
    portOpen: open,
    cycleOverLimit: late,
    alreadyRestarted: state.alreadyRestarted,
  })
  console.log(`[helper-watchdog] port=${open} late=${late} action=${decision.action} mode=${decision.mode}`)
  if (decision.action === 'ok') {
    const mode = await readSystemMode().catch(() => '')
    if (mode && mode !== 'RUN') {
      await writeSystemMode('RUN', 'helper listening')
      console.log('[helper-watchdog] System Mode set to RUN')
    }
    saveState({ alreadyRestarted: false, alerted: false })
    return
  }
  await writeSystemMode('DEGRADED', 'helper down')
  console.log('[helper-watchdog] System Mode set to DEGRADED')
  if (decision.action === 'restart') {
    restartHelper()
    saveState({ alreadyRestarted: true, alerted: false })
    return
  }
  if (!state.alerted) {
    const sent = await alertOnce()
    saveState({ alreadyRestarted: true, alerted: sent === true })
  }
}

console.log('[helper-watchdog] started')
await tick()
setInterval(() => {
  void tick().catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[helper-watchdog] tick failed: ${message}`)
  })
}, CHECK_MS)
