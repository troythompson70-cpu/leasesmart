/**
 * Live SharePoint decision write + immediate readback via local Graph proxy.
 * Fail-closed. Never invents SAVED+VERIFIED without server readback proof.
 */

export function decisionApiUrl() {
  if (typeof window !== 'undefined' && window.RCC_DECISION_URL) {
    return String(window.RCC_DECISION_URL);
  }
  return 'http://127.0.0.1:5173/api/opportunity-decision';
}

/**
 * @param {{ opportunityId: string, decision: string, patch?: object, actor?: string }} input
 */
export async function saveDecisionLive(input) {
  const url = decisionApiUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opportunityId: input.opportunityId,
        decision: input.decision,
        patch: input.patch || {},
        actor: input.actor || 'Troy',
      }),
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: body.status || 'WRITE_FAILED',
        message: body.message || body.error || `Decision write failed (HTTP ${res.status})`,
        approval_required: !!body.approval_required,
        gate_kind: body.gate_kind || null,
        error: body.error || null,
        feed: null,
      };
    }
    return {
      ok: true,
      status: body.status || 'SAVED_VERIFIED',
      message: body.message || 'SAVED + VERIFIED',
      feed: body.feed || null,
      written: body.written || null,
      readback: body.readback || null,
      writeProof: body.writeProof || null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 'WRITE_FAILED',
      message: `Decision API unreachable: ${err && err.message ? err.message : String(err)}`,
      approval_required: false,
      gate_kind: null,
      error: String(err && err.message ? err.message : err),
      feed: null,
    };
  }
}
