/**
 * Operational record decisions — Keep / Pass / Save / soft-remove.
 * Soft-remove leaves evidence; filters record out of the active queue.
 */

export const QUEUE_DECISIONS = Object.freeze({
  KEEP_ACTIVE: 'keep_active',
  PASS_NOT_FIT: 'pass_not_fit',
  SAVE_RECORD: 'save_record',
  REMOVE_FROM_QUEUE: 'remove_from_queue',
});

export const ARCHIVED_STATUSES = Object.freeze([
  'ARCHIVED',
  'REMOVED_FROM_QUEUE',
]);

function nowIso() {
  return new Date().toISOString();
}

function pushAudit(opp, entry) {
  const prev = Array.isArray(opp.decision_audit) ? opp.decision_audit : [];
  return [...prev, entry];
}

export function isRemovedFromActiveQueue(opp) {
  if (!opp) return false;
  const status = String(opp.status || '').toUpperCase();
  if (ARCHIVED_STATUSES.includes(status)) return true;
  if (opp.queue_state === 'removed_from_queue') return true;
  if (opp.removed_from_queue === true) return true;
  if (opp.archived === true) return true;
  return false;
}

/** Active queue = not soft-removed / archived. Evidence remains on the object. */
export function filterActiveQueue(opportunities) {
  return (opportunities || []).filter((o) => !isRemovedFromActiveQueue(o));
}

export function applyQueueDecision(opp, decision, actor = 'Troy', note = '') {
  if (!opp) return { ok: false, error: 'Missing opportunity' };
  const at = nowIso();
  const baseAudit = {
    at,
    actor,
    decision,
    note: String(note || '').slice(0, 500),
  };

  switch (decision) {
    case QUEUE_DECISIONS.KEEP_ACTIVE: {
      const next = {
        ...opp,
        queue_state: 'active',
        removed_from_queue: false,
        archived: false,
        status:
          String(opp.status || '').toUpperCase() === 'ARCHIVED' ||
          String(opp.status || '').toUpperCase() === 'REMOVED_FROM_QUEUE'
            ? 'OWNER_ACTION'
            : opp.status,
        decision_audit: pushAudit(opp, { ...baseAudit, result: 'kept_active' }),
        last_action: 'Keep Active',
        last_activity_at: at,
      };
      return { ok: true, opp: next };
    }
    case QUEUE_DECISIONS.PASS_NOT_FIT: {
      const next = {
        ...opp,
        status: 'PASS',
        queue_state: 'active',
        removed_from_queue: false,
        next_action: 'Passed — not a fit',
        decision_audit: pushAudit(opp, { ...baseAudit, result: 'pass_not_fit' }),
        last_action: 'Pass / Not a Fit',
        last_activity_at: at,
      };
      return { ok: true, opp: next };
    }
    case QUEUE_DECISIONS.SAVE_RECORD: {
      const next = {
        ...opp,
        record_saved_at: at,
        decision_audit: pushAudit(opp, { ...baseAudit, result: 'save_record' }),
        last_action: 'Save Record',
        last_activity_at: at,
      };
      return { ok: true, opp: next };
    }
    case QUEUE_DECISIONS.REMOVE_FROM_QUEUE: {
      // Soft removal — do not delete source evidence fields.
      const next = {
        ...opp,
        status: 'ARCHIVED',
        queue_state: 'removed_from_queue',
        removed_from_queue: true,
        archived: true,
        removed_from_queue_at: at,
        // Preserve evidence
        source: opp.source,
        source_ref: opp.source_ref,
        source_evidence: opp.source_evidence,
        most_recent_email: opp.most_recent_email,
        message_preview: opp.message_preview,
        notes: opp.notes,
        decision_audit: pushAudit(opp, {
          ...baseAudit,
          result: 'removed_from_queue_soft',
          evidence_retained: true,
        }),
        last_action: 'Delete / Remove from Queue (soft)',
        last_activity_at: at,
      };
      return { ok: true, opp: next };
    }
    default:
      return { ok: false, error: `Unknown decision: ${decision}` };
  }
}

/**
 * Conservative reply draft — never claims live send.
 */
export function prepareConservativeReplyDraft(opp, guidance) {
  const company = opp?.company || opp?.vendor || 'there';
  const next = guidance?.yourNextMove || opp?.next_action || 'confirm next steps';
  const hardHold = !!guidance?.hardHold;
  const subject = `Re: ${opp?.thread_subject || opp?.subject || opp?.opportunity || company}`;
  const body = hardHold
    ? [
        `Troy — HARD HOLD draft only for ${company}.`,
        '',
        'Do not send from RCC. Open the verified Outlook thread if a human reply is required.',
        '',
        `Context next move: ${next}`,
      ].join('\n')
    : [
        `Hi —`,
        '',
        `Following up regarding ${company}.`,
        '',
        `Proposed next step: ${next}`,
        '',
        '— Troy / TGT Technologies Inc.',
        '',
        '[DRAFT ONLY — not sent. Live send requires authenticated Microsoft Graph write.]',
      ].join('\n');

  return {
    mode: 'draft_only',
    canSendLive: false,
    hardHold,
    subject,
    body,
    outlookOpenRequiresConfirmation: true,
    warning:
      'Draft prepared only. Live email sending is disabled until a secure authenticated Microsoft Graph write endpoint is available.',
  };
}
