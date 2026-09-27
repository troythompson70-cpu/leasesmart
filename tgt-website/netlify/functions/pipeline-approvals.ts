import { runApprovalsCloud } from '../../server/cloud-runner.ts'

export default async () => {
  await runApprovalsCloud(console.log)
  return new Response('ok')
}

export const config = { schedule: '*/15 * * * *' }
