import { CONTACT_EMAIL } from '../content'

export function buildMailto(options: {
  subject: string
  body: string
}): string {
  const subject = encodeURIComponent(options.subject)
  const body = encodeURIComponent(options.body)
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
}

export function openMailto(options: {
  subject: string
  body: string
}): void {
  window.location.href = buildMailto(options)
}
