/** Cloud sends stay off until DRY_RUN is exactly 0. That is the CUTOVER switch. */
export function cloudLiveEnabled(): boolean {
  return process.env.DRY_RUN === '0'
}

export function dryRunWouldSend(log: (line: string) => void, line: string): void {
  log(`[dry-run] would send: ${line}`)
}
