/** Instant in-page jump. Smooth CSS scroll plus YouTube iframes can lock wheel. */
export function scrollToHash(hash: string): void {
  const id = hash.replace(/^#/, '')
  if (!id) return
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'auto', block: 'start' })
}
