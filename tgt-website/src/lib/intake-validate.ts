type JsonRecord = Record<string, unknown>

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

export type IntakeHandleResult =
  | { ok: true; delivery: 'confirmed'; requestId: string; requestType: string }
  | { ok: false; error: string; status: number }

export function validateIntakePayload(raw: unknown): IntakeHandleResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'invalid_request', status: 400 }
  }

  const body = raw as JsonRecord
  const schemaVersion = asString(body.schemaVersion)
  const requestType = asString(body.requestType)
  const submissionId = asString(body.submissionId)

  if (schemaVersion !== '1.1' || !submissionId || !validUuid(submissionId)) {
    return { ok: false, error: 'invalid_request', status: 400 }
  }

  if (requestType === 'laptop_inquiry') {
    const name = asString(body.name)
    const email = asString(body.email)
    const phone = asString(body.bestCallbackNumber)
    const offer = asString(body.offer)
    if (!name || !validEmail(email) || !phone || offer !== '280-ai-laptop') {
      return { ok: false, error: 'invalid_request', status: 400 }
    }
    return {
      ok: true,
      delivery: 'confirmed',
      requestId: submissionId,
      requestType,
    }
  }

  if (requestType === 'newsletter') {
    const email = asString(body.email)
    const consent = body.newsletterConsent === true
    const phonePlatform = asString(body.phonePlatform)
    if (!validEmail(email) || !consent || !phonePlatform) {
      return { ok: false, error: 'invalid_request', status: 400 }
    }
    return {
      ok: true,
      delivery: 'confirmed',
      requestId: submissionId,
      requestType,
    }
  }

  if (requestType === 'assessment') {
    const name = asString(body.name)
    const email = asString(body.email)
    const phone = asString(body.bestCallbackNumber)
    if (!name || !validEmail(email) || !phone) {
      return { ok: false, error: 'invalid_request', status: 400 }
    }
    return {
      ok: true,
      delivery: 'confirmed',
      requestId: submissionId,
      requestType,
    }
  }

  return { ok: false, error: 'invalid_request', status: 400 }
}
