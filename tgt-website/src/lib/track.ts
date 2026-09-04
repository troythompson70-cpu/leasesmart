import { ga4MeasurementId } from '../content'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export type CtaEvent =
  | 'signup_click'
  | 'signup_submit'
  | 'laptop_inquiry'
  | 'video_play'
  | 'remote_help_inquiry'
  | 'referral_click'
  | 'business_assessment_click'
  | 'ask_gates_click'

export function track(event: CtaEvent, detail?: Record<string, string>): void {
  const payload = { event, ...detail, ts: new Date().toISOString() }

  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push(payload)

    if (typeof window.gtag === 'function' && ga4MeasurementId) {
      window.gtag('event', event, detail ?? {})
    }
  }

  if (import.meta.env.DEV) {
    console.info('[tgt-track]', payload)
  }
}
