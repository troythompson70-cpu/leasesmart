import { CONTACT_EMAIL } from '../content'

/**
 * Build a mailto URL.
 *
 * IMPORTANT: Do NOT use URLSearchParams here. URLSearchParams encodes spaces as
 * `+` (form-urlencoded). Many mail clients (including Outlook) leave those as
 * literal `+` characters in the subject/body — the live $280 laptop CTA bug.
 * encodeURIComponent uses %20 and is required for mailto.
 */
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
