import assert from 'node:assert/strict'
import { cycleOverLimit } from '../server/helper-heartbeat.ts'
import { watchdogAction } from '../server/helper-watchdog.ts'

assert.deepEqual(watchdogAction({ portOpen: true, cycleOverLimit: false, alreadyRestarted: false }), {
  action: 'ok',
  mode: 'RUN',
})
assert.deepEqual(watchdogAction({ portOpen: false, cycleOverLimit: false, alreadyRestarted: false }), {
  action: 'restart',
  mode: 'DEGRADED',
})
assert.deepEqual(watchdogAction({ portOpen: false, cycleOverLimit: false, alreadyRestarted: true }), {
  action: 'alert',
  mode: 'DEGRADED',
})
assert.deepEqual(watchdogAction({ portOpen: true, cycleOverLimit: true, alreadyRestarted: false }), {
  action: 'restart',
  mode: 'DEGRADED',
})

const now = Date.parse('2026-09-26T23:00:00.000Z')
assert.equal(
  cycleOverLimit(
    { pid: 1, startedAt: '2026-09-26T22:00:00.000Z', cycles: { copy: { startedAt: '2026-09-26T22:30:00.000Z', finishedAt: null } } },
    now,
  ),
  true,
)
assert.equal(
  cycleOverLimit(
    { pid: 1, startedAt: '2026-09-26T22:00:00.000Z', cycles: { copy: { startedAt: '2026-09-26T22:50:00.000Z', finishedAt: null } } },
    now,
  ),
  false,
)

console.log('helper-watchdog-check: PASS')
