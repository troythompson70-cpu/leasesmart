type TimerMap = Record<string, ReturnType<typeof setInterval>>

function timers(): TimerMap {
  const g = globalThis as typeof globalThis & { __tgtLoopTimers?: TimerMap }
  if (!g.__tgtLoopTimers) g.__tgtLoopTimers = {}
  return g.__tgtLoopTimers
}

/**
 * One timer per name for the life of this process.
 * Vite restarts re-import the module, which used to leave the old timer running.
 */
export function replaceInterval(name: string, tick: () => void, intervalMs: number): void {
  const active = timers()
  if (active[name]) clearInterval(active[name])
  tick()
  active[name] = setInterval(tick, intervalMs)
}
