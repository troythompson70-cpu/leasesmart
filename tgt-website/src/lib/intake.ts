import {
  assertSafeIntakeEmail,
  isProductionIntakeUrl,
  resolveIntakePostUrl,
} from './intake-probe-guard'
import { ninthEdition, type TipTopicId } from '../content'

export type IntakeMode = 'api' | 'formspark' | 'unconfigured'

export type IntakeConfig = {
  mode: IntakeMode
  apiEndpoint: string
  formsparkId: string
}

/** Matches the live tgttechnologies.com intake contract (schema 1.1). */
export const intakeConfig: IntakeConfig = {
  mode: 'api',
  apiEndpoint: '/api/intake',
  formsparkId: '',
}

export const NEWSLETTER_CONSENT_TEXT_VERSION = 'tgt-tips-email-v1-2026-09-08'

export type LaptopInquiryPayload = {
  schemaVersion: '1.1'
  requestType: 'laptop_inquiry'
  submissionId: string
  name: string
  email: string
  bestCallbackNumber: string
  message: string
  offer: '280-ai-laptop'
  source: 'tgt-website-laptop'
  ninthEdition: null
}

export type AssessmentFallbackPayload = {
  schemaVersion: '1.1'
  requestType: 'assessment'
  submissionId: string
  name: string
  company: string
  email: string
  bestCallbackNumber: string
  numberOfPcs: string
  server: string
  existingNetworkWifi: string
  internetConnectivityIssue: string[]
  currentItSupport: string[]
  message: string
  newsletterConsent: false
  newsletterPhonePlatform: ''
  newsletterConsentTextVersion: ''
  source: 'tgt-website-laptop'
}

export type NewsletterPayload = {
  schemaVersion: '1.1'
  requestType: 'newsletter'
  submissionId: string
  name: string
  email: string
  newsletterConsent: true
  phonePlatform: 'iphone' | 'android' | 'both'
  contentLane: string
  topics: TipTopicId[]
  consentTextVersion: string
  source: 'tgt-website-newsletter' | 'tgt-website-newsletter-repeat'
}

export type IntakeSuccess = {
  ok: true
  delivery: 'confirmed'
  requestId: string
  method: 'laptop_inquiry' | 'assessment' | 'newsletter'
}

export type IntakeFailure = {
  ok: false
  error: string
}

function newSubmissionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `intake-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function mapTopicsToPhonePlatform(
  topics: TipTopicId[],
): NewsletterPayload['phonePlatform'] {
  const hasIphone = topics.includes('iphone')
  const hasAndroid = topics.includes('android')
  if (hasIphone && hasAndroid) return 'both'
  if (hasIphone) return 'iphone'
  if (hasAndroid) return 'android'
  // Live apex expects iphone|android|both — non-device topic picks still enroll.
  return 'both'
}

export function buildLaptopInquiryPayload(input: {
  name: string
  email: string
  phone: string
  message: string
  ninthEdition?: null
}): LaptopInquiryPayload {
  return {
    schemaVersion: '1.1',
    requestType: 'laptop_inquiry',
    submissionId: newSubmissionId(),
    name: input.name.trim(),
    email: input.email.trim(),
    bestCallbackNumber: input.phone.trim(),
    message: input.message.trim(),
    offer: '280-ai-laptop',
    source: 'tgt-website-laptop',
    ninthEdition: input.ninthEdition === undefined ? ninthEdition : input.ninthEdition,
  }
}

export function buildAssessmentFallbackPayload(
  payload: LaptopInquiryPayload,
): AssessmentFallbackPayload {
  return {
    schemaVersion: '1.1',
    requestType: 'assessment',
    submissionId: payload.submissionId,
    name: payload.name,
    company: '',
    email: payload.email,
    bestCallbackNumber: payload.bestCallbackNumber,
    numberOfPcs: '',
    server: '',
    existingNetworkWifi: '',
    internetConnectivityIssue: [],
    currentItSupport: [],
    message: [
      'Interest: $280 AI-ready laptop',
      payload.message,
      '',
      '(Submitted via laptop inquiry form — assessment fallback path)',
    ]
      .filter(Boolean)
      .join('\n'),
    newsletterConsent: false,
    newsletterPhonePlatform: '',
    newsletterConsentTextVersion: '',
    source: 'tgt-website-laptop',
  }
}

export function buildNewsletterPayload(input: {
  name: string
  email: string
  topics: TipTopicId[]
  source?: NewsletterPayload['source']
}): NewsletterPayload {
  const phonePlatform = mapTopicsToPhonePlatform(input.topics)
  const contentLane =
    phonePlatform === 'both' ? 'iphone-and-android' : phonePlatform

  return {
    schemaVersion: '1.1',
    requestType: 'newsletter',
    submissionId: newSubmissionId(),
    name: input.name.trim(),
    email: input.email.trim(),
    newsletterConsent: true,
    phonePlatform,
    contentLane,
    topics: [...input.topics],
    consentTextVersion: NEWSLETTER_CONSENT_TEXT_VERSION,
    source: input.source ?? 'tgt-website-newsletter',
  }
}

function isConfirmed(body: unknown): body is {
  ok: true
  delivery: 'confirmed'
  requestId: string
} {
  if (!body || typeof body !== 'object') return false
  const record = body as Record<string, unknown>
  return (
    record.ok === true &&
    record.delivery === 'confirmed' &&
    typeof record.requestId === 'string' &&
    record.requestId.length > 0
  )
}

function currentHostname(): string {
  if (typeof window === 'undefined') return 'localhost'
  return window.location.hostname
}

function currentOrigin(): string {
  if (typeof window === 'undefined') return 'http://localhost'
  return window.location.origin
}

function guardEmailOrFail(email: string): IntakeFailure | null {
  const guard = assertSafeIntakeEmail(email, currentHostname())
  if (!guard.ok) return { ok: false, error: guard.error }
  return null
}

async function postIntake(endpoint: string, payload: unknown): Promise<Response> {
  const url = resolveIntakePostUrl(endpoint, currentOrigin())
  if (isProductionIntakeUrl(url)) {
    const record =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : null
    const email = typeof record?.email === 'string' ? record.email : ''
    const blocked = guardEmailOrFail(email)
    if (blocked) {
      throw new Error(blocked.error)
    }
  }

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
}

/**
 * Submit a laptop inquiry through protected intake.
 * Prefers requestType laptop_inquiry; falls back to assessment on hosts that
 * only accept newsletter/assessment (current live ChatGPT custom-domain API).
 */
export async function submitLaptopInquiry(input: {
  name: string
  email: string
  phone: string
  message: string
  ninthEdition?: null
}): Promise<IntakeSuccess | IntakeFailure> {
  if (intakeConfig.mode !== 'api' || !intakeConfig.apiEndpoint) {
    return { ok: false, error: 'No protected intake destination is configured' }
  }

  const blocked = guardEmailOrFail(input.email)
  if (blocked) return blocked

  const primary = buildLaptopInquiryPayload(input)

  try {
    const primaryRes = await postIntake(intakeConfig.apiEndpoint, primary)
    const primaryBody: unknown = await primaryRes.json().catch(() => null)

    if (primaryRes.ok && isConfirmed(primaryBody)) {
      return {
        ok: true,
        delivery: 'confirmed',
        requestId: primaryBody.requestId,
        method: 'laptop_inquiry',
      }
    }

    // Live apex currently accepts newsletter + assessment only.
    const fallback = buildAssessmentFallbackPayload(primary)
    const fallbackRes = await postIntake(intakeConfig.apiEndpoint, fallback)
    const fallbackBody: unknown = await fallbackRes.json().catch(() => null)

    if (fallbackRes.ok && isConfirmed(fallbackBody)) {
      return {
        ok: true,
        delivery: 'confirmed',
        requestId: fallbackBody.requestId,
        method: 'assessment',
      }
    }

    return { ok: false, error: 'Inquiry could not be completed. Please try again.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('Test/probe email blocked')) {
      return { ok: false, error: message }
    }
    return { ok: false, error: 'Inquiry could not be completed. Please try again.' }
  }
}

/** Submit TGT Tips newsletter signup through protected intake (no mailto / Outlook). */
export async function submitNewsletterSignup(input: {
  name: string
  email: string
  topics: TipTopicId[]
  source?: NewsletterPayload['source']
}): Promise<IntakeSuccess | IntakeFailure> {
  if (intakeConfig.mode !== 'api' || !intakeConfig.apiEndpoint) {
    return { ok: false, error: 'No protected intake destination is configured' }
  }

  const blocked = guardEmailOrFail(input.email)
  if (blocked) return blocked

  const payload = buildNewsletterPayload(input)

  try {
    const res = await postIntake(intakeConfig.apiEndpoint, payload)
    const body: unknown = await res.json().catch(() => null)
    if (res.ok && isConfirmed(body)) {
      return {
        ok: true,
        delivery: 'confirmed',
        requestId: body.requestId,
        method: 'newsletter',
      }
    }
    return { ok: false, error: 'Signup could not be completed. Please try again.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('Test/probe email blocked')) {
      return { ok: false, error: message }
    }
    return { ok: false, error: 'Signup could not be completed. Please try again.' }
  }
}
