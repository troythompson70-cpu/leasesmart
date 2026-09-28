/**
 * Safe typed/voice TGT assistant — no live Graph send.
 * May refresh, filter, open records, prepare drafts, prepare confirmed record changes.
 */

import { buildActionGuidance } from './executive-readout.js';
import {
  QUEUE_DECISIONS,
  applyQueueDecision,
  prepareConservativeReplyDraft,
} from './record-decisions.js';

const FILTERS = new Set(['all', 'incoming', 'new-activity', 'new-replies']);

function normalize(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function findOppByHint(opportunities, hint) {
  const h = normalize(hint);
  if (!h) return null;
  return (
    (opportunities || []).find((o) => {
      const id = String(o.opportunity_id || o.id || '').toLowerCase();
      const company = String(o.company || o.vendor || '').toLowerCase();
      return id === h || company.includes(h) || h.includes(company);
    }) || null
  );
}

/**
 * @param {string} utterance
 * @param {{ opportunities: any[], filter: string }} ctx
 * @returns {{ ok: boolean, actions: object[], reply: string, draft?: object, pendingDecision?: object }}
 */
export function interpretAssistantCommand(utterance, ctx = {}) {
  const text = normalize(utterance);
  const opps = ctx.opportunities || [];
  const actions = [];

  if (!text) {
    return {
      ok: false,
      actions: [],
      reply: 'Say or type a command: refresh, show incoming, open Optus, draft reply for Cisco, keep active SW-016, pass PC Matic, save Huntress, remove Example Passed.',
    };
  }

  if (/^(refresh|reload|reconcile)\b/.test(text) || text === 'sync') {
    actions.push({ type: 'refresh' });
    return { ok: true, actions, reply: 'Refreshing / reconciling the feed.' };
  }

  if (/show (all|everything)|filter all|go to all/.test(text)) {
    actions.push({ type: 'set_filter', filter: 'all' });
    return { ok: true, actions, reply: 'Showing all active opportunities.' };
  }
  if (/incoming/.test(text)) {
    actions.push({ type: 'set_filter', filter: 'incoming' });
    return { ok: true, actions, reply: 'Filtering to Incoming.' };
  }
  if (/new replies?/.test(text)) {
    actions.push({ type: 'set_filter', filter: 'new-replies' });
    return { ok: true, actions, reply: 'Filtering to NEW REPLIES.' };
  }
  if (/new activity|unread/.test(text)) {
    actions.push({ type: 'set_filter', filter: 'new-activity' });
    return { ok: true, actions, reply: 'Filtering to New Activity.' };
  }

  const openMatch = text.match(/^(open|show|view)\s+(.+)$/);
  if (openMatch) {
    const hint = openMatch[2].replace(/\b(record|card|opportunity)\b/g, '').trim();
    const opp = findOppByHint(opps, hint);
    if (!opp) {
      return { ok: false, actions: [], reply: `I could not find an active record matching “${hint}”.` };
    }
    const id = opp.opportunity_id || opp.id;
    actions.push({ type: 'open_record', id });
    return {
      ok: true,
      actions,
      reply: `Opening ${opp.company || opp.vendor || id}.`,
    };
  }

  const draftMatch = text.match(/^(draft|prepare)\s+(reply|email|follow-?up)\s+(for\s+)?(.+)$/);
  if (draftMatch || /^draft\s+(.+)$/.test(text)) {
    const hint = draftMatch ? draftMatch[4] : text.replace(/^draft\s+/, '');
    const opp = findOppByHint(opps, hint);
    if (!opp) {
      return { ok: false, actions: [], reply: `No record found to draft for “${hint}”.` };
    }
    const guidance = buildActionGuidance(opp);
    const draft = prepareConservativeReplyDraft(opp, guidance);
    actions.push({ type: 'show_draft', id: opp.opportunity_id || opp.id, draft });
    return {
      ok: true,
      actions,
      draft,
      reply: guidance.hardHold
        ? `HARD HOLD draft prepared for ${opp.company || 'record'} — not sent. Open Outlook only with confirmation.`
        : `Draft prepared for ${opp.company || 'record'} — not sent. Live Graph send is unavailable.`,
    };
  }

  const decisionMatchers = [
    { re: /^(keep( active)?|stay active)\s+(.+)$/, decision: QUEUE_DECISIONS.KEEP_ACTIVE },
    { re: /^(pass|not a fit)\s+(.+)$/, decision: QUEUE_DECISIONS.PASS_NOT_FIT },
    { re: /^(save( record)?)\s+(.+)$/, decision: QUEUE_DECISIONS.SAVE_RECORD },
    {
      re: /^(delete|remove|archive)\s+(.+)$/,
      decision: QUEUE_DECISIONS.REMOVE_FROM_QUEUE,
    },
  ];
  for (const m of decisionMatchers) {
    const hit = text.match(m.re);
    if (!hit) continue;
    const hint = hit[hit.length - 1].replace(/\b(from queue|record|card)\b/g, '').trim();
    const opp = findOppByHint(opps, hint);
    if (!opp) {
      return { ok: false, actions: [], reply: `No active record matching “${hint}”.` };
    }
    const id = opp.opportunity_id || opp.id;
    const pendingDecision = {
      id,
      decision: m.decision,
      company: opp.company || opp.vendor || id,
      requiresConfirm: m.decision === QUEUE_DECISIONS.REMOVE_FROM_QUEUE,
    };
    actions.push({ type: 'prepare_decision', ...pendingDecision });
    return {
      ok: true,
      actions,
      pendingDecision,
      reply:
        m.decision === QUEUE_DECISIONS.REMOVE_FROM_QUEUE
          ? `Prepared soft-remove for ${pendingDecision.company}. Confirm to leave the active queue without deleting evidence.`
          : `Prepared “${m.decision}” for ${pendingDecision.company}. Confirm to apply.`,
    };
  }

  if (FILTERS.has(text)) {
    actions.push({ type: 'set_filter', filter: text });
    return { ok: true, actions, reply: `Filter set to ${text}.` };
  }

  return {
    ok: false,
    actions: [],
    reply:
      'I can refresh, filter, open records, prepare reply drafts, and prepare Keep / Pass / Save / soft-remove. I cannot send live email without Graph write auth.',
  };
}

export function applyPreparedDecision(opp, decision, actor = 'Troy') {
  return applyQueueDecision(opp, decision, actor);
}

export { QUEUE_DECISIONS, findOppByHint };
