import { runLeadCopyCloud } from '../../server/cloud-runner.ts'

export default async () => {
  await runLeadCopyCloud(console.log)
  return new Response('ok')
}

export const config = { schedule: '*/15 * * * *' }
