import { runFeedVerifyCloud } from '../../server/cloud-runner.ts'

export default async () => {
  await runFeedVerifyCloud(console.log)
  return new Response('ok')
}

export const config = { schedule: '*/15 * * * *' }
