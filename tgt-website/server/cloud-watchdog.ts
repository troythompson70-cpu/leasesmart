/** Netlify scheduled functions time out at 30 seconds. Stay under 25. */
export const NETLIFY_SCHEDULE_LIMIT_MS = 30_000
export const CLOUD_TIME_BUDGET_MS = 25_000
export const HEARTBEAT_STALE_MS = 35 * 60 * 1000

export function heartbeatIsStale(lastBeatMs: number | null, nowMs: number): boolean {
  if (lastBeatMs === null) return true
  return nowMs - lastBeatMs > HEARTBEAT_STALE_MS
}

/** A stale heartbeat emails once. A second check while alerted does not email again. */
export function cloudAlertDue(lastBeatMs: number | null, nowMs: number, alreadyAlerted: boolean): boolean {
  if (alreadyAlerted) return false
  return heartbeatIsStale(lastBeatMs, nowMs)
}
