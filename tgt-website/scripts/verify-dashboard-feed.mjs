#!/usr/bin/env node
/**
 * Live dashboard-feed verification cycle.
 * GET Inbox + SharePoint read-back only. Never POST /api/intake. Never stamps GREEN.
 *
 * Default: dry-run (print report, do not PUT).
 * --write: PUT probe-proven checks into SharePoint 10 Dashboard Feed.
 */
import { appendFileSync } from 'node:fs'
import { verifyDashboardFeed } from '../server/verify-dashboard-feed.ts'

const write = process.argv.includes('--write')
const report = await verifyDashboardFeed({ write })
const publicReport = {
  greenEligible: report.greenEligible,
  findings: report.findings,
  checks: report.checks,
  status: report.status,
  last_verified_at: report.last_verified_at,
  incoming_last_verified_at: report.incoming_last_verified_at,
  probeEvidence: report.probeEvidence,
  wrote: report.wrote,
  writePath: report.writePath,
}
console.log(JSON.stringify(publicReport, null, 2))

appendFileSync(
  new URL('../../.cursor/debug-ab753e.log', import.meta.url),
  `${JSON.stringify({
    sessionId: 'ab753e',
    runId: 'feed-verify',
    hypothesisId: 'probe-vs-declared',
    location: 'scripts/verify-dashboard-feed.mjs',
    message: 'verification cycle',
    data: publicReport,
    timestamp: Date.now(),
  })}\n`,
)

if (report.greenEligible) {
  process.exitCode = 0
} else {
  process.exitCode = 2
}
