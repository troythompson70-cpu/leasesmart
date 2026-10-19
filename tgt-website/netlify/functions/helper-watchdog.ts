import { cloudAlertDue } from '../../server/cloud-watchdog.ts'
import { cloudLiveEnabled, dryRunWouldSend } from '../../server/dry-run.ts'
import { SharePointHelperState } from '../../server/helper-state.ts'

export default async () => {
  if (!process.env.HELPER_STATE_LIST_ID) {
    console.log('[helper-watchdog] HELPER_STATE_LIST_ID is not set')
    return new Response('skipped')
  }
  const state = new SharePointHelperState()
  const beat = (await state.read('heartbeat')) as { at?: number; alerted?: boolean } | null
  const due = cloudAlertDue(beat?.at ?? null, Date.now(), beat?.alerted === true)
  if (!due) return new Response('ok')
  if (!cloudLiveEnabled()) dryRunWouldSend(console.log, 'watchdog alert')
  await state.write('heartbeat', { at: beat?.at ?? null, alerted: true })
  return new Response('alert')
}

export const config = { schedule: '*/15 * * * *' }
