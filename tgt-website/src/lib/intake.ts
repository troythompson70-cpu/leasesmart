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

export type IntakeSuccess = {
  ok: true
  delivery: 'confirmed'
  requestId: string
  method: 'laptop_inquiry' | 'assessment'
}

export type IntakeFailure = {
  ok: false
  error: string
}

function newSubmissionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `laptop-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function buildLaptopInquiryPayload(input: {
  name: string
  email: string
  phone: string
  message: string
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

async function postIntake(endpoint: string, payload: unknown): Promise<Response> {
  return fetch(endpoint, {
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
}): Promise<IntakeSuccess | IntakeFailure> {
  if (intakeConfig.mode !== 'api' || !intakeConfig.apiEndpoint) {
    return { ok: false, error: 'No protected intake destination is configured' }
  }

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
  } catch {
    return { ok: false, error: 'Inquiry could not be completed. Please try again.' }
  }
}
