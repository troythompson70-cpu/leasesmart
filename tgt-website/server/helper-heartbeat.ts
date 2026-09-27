import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const HELPER_DIR = join(homedir(), '.tgt-helper')
export const HEARTBEAT_PATH = join(HELPER_DIR, 'heartbeat.json')
export const CYCLE_LIMIT_MS = 20 * 60 * 1000

export type CycleStamp = { startedAt: string; finishedAt: string | null }

export type HelperHeartbeat = {
  pid: number
  startedAt: string
  cycles: Record<string, CycleStamp>
}

function emptyHeartbeat(): HelperHeartbeat {
  return { pid: process.pid, startedAt: new Date().toISOString(), cycles: {} }
}

export function readHeartbeat(): HelperHeartbeat {
  try {
    const parsed = JSON.parse(readFileSync(HEARTBEAT_PATH, 'utf8')) as HelperHeartbeat
    if (!parsed || typeof parsed !== 'object') return emptyHeartbeat()
    return {
      pid: Number(parsed.pid) || process.pid,
      startedAt: String(parsed.startedAt || new Date().toISOString()),
      cycles: parsed.cycles && typeof parsed.cycles === 'object' ? parsed.cycles : {},
    }
  } catch {
    return emptyHeartbeat()
  }
}

function save(beat: HelperHeartbeat): void {
  mkdirSync(HELPER_DIR, { recursive: true, mode: 0o700 })
  writeFileSync(HEARTBEAT_PATH, JSON.stringify(beat), { mode: 0o600 })
}

export function markHelperUp(): void {
  const beat = readHeartbeat()
  beat.pid = process.pid
  beat.startedAt = new Date().toISOString()
  save(beat)
}

export function beginCycle(name: string): void {
  const beat = readHeartbeat()
  beat.pid = process.pid
  beat.cycles[name] = { startedAt: new Date().toISOString(), finishedAt: null }
  save(beat)
}

export function endCycle(name: string): void {
  const beat = readHeartbeat()
  const cycle = beat.cycles[name]
  if (!cycle) return
  cycle.finishedAt = new Date().toISOString()
  save(beat)
}

export function cycleOverLimit(beat: HelperHeartbeat, nowMs: number, limitMs = CYCLE_LIMIT_MS): boolean {
  for (const cycle of Object.values(beat.cycles || {})) {
    if (!cycle || cycle.finishedAt) continue
    const started = Date.parse(cycle.startedAt)
    if (Number.isFinite(started) && nowMs - started > limitMs) return true
  }
  return false
}
