#!/usr/bin/env node
import assert from 'node:assert/strict'
import { applyVerifiedProbeFacts } from '../server/verify-dashboard-feed.ts'

function pass(name) {
  console.log(`PASS ${name}`)
}

const staleFeed = {
  records: [{ opportunity_id: 'REV-012', lead_id: 'REV-012', status: 'BLOCKED' }],
  ui_sync_health: {
    status: 'BLOCKED',
    last_verified_at: '2026-09-14T17:55:24-04:00',
    checks: {
      mailbox_coverage: 'BLOCKED',
      app_runtime_record_readback: 'BLOCKED',
    },
    counts: {
      invalid_routes: 1,
      blocked_sync_writes: 1,
    },
    blocked_sync_writes: 1,
  },
}

const passProbe = (check) => ({
  check,
  status: 'PASS',
  http: 200,
  detail: 'ok',
})

{
  const report = applyVerifiedProbeFacts({
    feed: staleFeed,
    mailbox: passProbe('mailbox_coverage'),
    readback: passProbe('app_runtime_record_readback'),
    now: new Date('2026-09-21T03:50:00.000Z'),
  })
  assert.equal(report.greenEligible, false)
  assert.deepEqual(report.findings, [
    'invalid_routes=1',
    'blocked_sync_writes=1',
    'REV-012 remains BLOCKED',
    'verification data older than 4 hours',
  ])
  assert.equal(report.checks.mailbox_coverage, 'PASS')
  assert.equal(report.checks.app_runtime_record_readback, 'PASS')
  assert.equal(report.status, 'BLOCKED')
  assert.equal(report.feed.ui_sync_health.status, 'BLOCKED')
  assert.equal(report.feed.ui_sync_health.checks.mailbox_coverage, 'PASS')
  assert.equal(report.feed.records[0].status, 'BLOCKED')
  pass('stale feed: probe PASS, overall BLOCKED, expected findings')
}

{
  const feed = structuredClone(staleFeed)
  feed.ui_sync_health.counts.invalid_routes = 0
  feed.ui_sync_health.counts.blocked_sync_writes = 0
  feed.ui_sync_health.blocked_sync_writes = 0
  feed.records[0].status = 'CONTACT_READY'
  feed.ui_sync_health.last_verified_at = '2026-09-21T03:00:00.000Z'
  const report = applyVerifiedProbeFacts({
    feed,
    mailbox: passProbe('mailbox_coverage'),
    readback: passProbe('app_runtime_record_readback'),
    now: new Date('2026-09-21T03:50:00.000Z'),
  })
  assert.equal(report.greenEligible, true)
  assert.deepEqual(report.findings, [])
  assert.equal(report.feed.ui_sync_health.status, 'BLOCKED')
  pass('eligible report still does not stamp GREEN onto the feed')
}

{
  const report = applyVerifiedProbeFacts({
    feed: staleFeed,
    mailbox: { check: 'mailbox_coverage', status: 'BLOCKED', http: 403, detail: 'denied' },
    readback: passProbe('app_runtime_record_readback'),
    now: new Date('2026-09-21T03:50:00.000Z'),
  })
  assert.equal(report.checks.mailbox_coverage, 'BLOCKED')
  assert.equal(report.greenEligible, false)
  pass('failed mailbox probe is not written as PASS')
}

console.log('All verify-dashboard-feed checks passed.')
