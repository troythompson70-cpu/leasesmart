export type WatchdogInput = {
  portOpen: boolean
  cycleOverLimit: boolean
  alreadyRestarted: boolean
}

export type WatchdogAction = 'ok' | 'restart' | 'alert'

/** Down or a cycle past 20 minutes is never RUN. Restart once, then alert. */
export function watchdogAction(input: WatchdogInput): { action: WatchdogAction; mode: 'RUN' | 'DEGRADED' } {
  const unhealthy = !input.portOpen || input.cycleOverLimit
  if (!unhealthy) return { action: 'ok', mode: 'RUN' }
  if (!input.alreadyRestarted) return { action: 'restart', mode: 'DEGRADED' }
  return { action: 'alert', mode: 'DEGRADED' }
}
