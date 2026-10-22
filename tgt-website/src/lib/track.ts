declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

export type CtaEvent =
  | 'signup_click'
  | 'signup_submit'
  | 'signup_error'
  | 'signup_success'
  | 'laptop_inquiry'
  | 'video_play'
  | 'remote_help_inquiry'
  | 'referral_click'
  | 'business_assessment_click'
  | 'ask_gates_click'
  | 'contact_click'

export function track(event: CtaEvent, detail?: Record<string, string>): void {
  const payload = { event, ...detail, ts: new Date().toISOString() }

  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push(payload)
  }

  if (import.meta.env.DEV) {
    console.info('[tgt-track]', payload)
  }
}
