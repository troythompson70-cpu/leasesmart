import { cloudAlertDue } from './cloud-watchdog.ts'
import { cloudLiveEnabled, dryRunWouldSend } from './dry-run.ts'
import { applyApprovalReplies, rowsNeedingApproval, sendPendingApprovals, type ApprovalRow } from './pipeline-approvals.ts'
import { copyNewWebsiteLeads, selectLeadsToCopy, type WebsiteLead } from './website-lead-copy.ts'
import { verifyDashboardFeed } from './verify-dashboard-feed.ts'

export async function runLeadCopyCloud(log: (line: string) => void = console.log) {
  if (!cloudLiveEnabled()) {
    dryRunWouldSend(log, 'lead-copy')
    return []
  }
  return copyNewWebsiteLeads(log)
}

export async function runApprovalsCloud(log: (line: string) => void = console.log) {
  if (!cloudLiveEnabled()) {
    dryRunWouldSend(log, 'pipeline-approvals')
    return []
  }
  const sent = await sendPendingApprovals(log)
  await applyApprovalReplies(log)
  return sent
}

export async function runFeedVerifyCloud(log: (line: string) => void = console.log) {
  if (!cloudLiveEnabled()) {
    dryRunWouldSend(log, 'feed-verify')
    return
  }
  await verifyDashboardFeed({ write: true })
  log('[feed-verify] wrote live feed')
}

export function secondPassSendsNothing(rows: ApprovalRow[], sentIds: string[], leads: WebsiteLead[], copiedIds: Set<string>): boolean {
  return rowsNeedingApproval(rows, sentIds).length === 0 && selectLeadsToCopy(leads, copiedIds).length === 0
}

export function alertCount(lastBeatMs: number | null, nowMs: number): number {
  const first = cloudAlertDue(lastBeatMs, nowMs, false)
  const second = cloudAlertDue(lastBeatMs, nowMs, true)
  return Number(first) + Number(second)
}
