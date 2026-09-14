/**
 * Deduplication — never create a second active record for the same thread.
 */
import { CLOSED_STATUSES } from './constants.js';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^(re|fw|fwd):\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function companyKey(s) {
  return norm(s).replace(/[^a-z0-9]+/g, '');
}

function isActive(opp) {
  return !CLOSED_STATUSES.includes(String(opp.status || '').toUpperCase());
}

/**
 * Find matching active opportunity before create.
 * @returns {{ match: object|null, reason: string|null }}
 */
export function findExistingOpportunity(opportunities, candidate) {
  const list = (opportunities || []).filter(isActive);
  const cCompany = companyKey(candidate.company || candidate.vendor);
  const cSubject = norm(candidate.thread_subject || candidate.subject);
  const cThread = String(candidate.thread_id || candidate.message_id || '').trim();
  const cOppId = String(candidate.opportunity_id || candidate.id || '').trim();

  for (const opp of list) {
    if (cOppId && String(opp.opportunity_id || opp.id) === cOppId) {
      return { match: opp, reason: 'opportunity_id' };
    }
    if (
      cThread &&
      (String(opp.thread_id || '') === cThread ||
        String(opp.message_id || '') === cThread)
    ) {
      return { match: opp, reason: 'thread_id' };
    }
    const oCompany = companyKey(opp.company || opp.vendor);
    const oSubject = norm(opp.thread_subject || opp.subject);
    if (cCompany && oCompany && cCompany === oCompany && cSubject && oSubject === cSubject) {
      return { match: opp, reason: 'company+subject' };
    }
  }
  return { match: null, reason: null };
}

/**
 * Detect duplicate key collisions among active records.
 */
export function findDuplicateCollisions(opportunities) {
  const active = (opportunities || []).filter(isActive);
  const byKey = new Map();
  const collisions = [];

  for (const opp of active) {
    const keys = [];
    if (opp.thread_id) keys.push(`thread:${opp.thread_id}`);
    if (opp.message_id) keys.push(`msg:${opp.message_id}`);
    const ck = companyKey(opp.company || opp.vendor);
    const sk = norm(opp.thread_subject || opp.subject);
    if (ck && sk) keys.push(`cs:${ck}|${sk}`);
    for (const k of keys) {
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(opp);
    }
  }

  for (const [key, group] of byKey.entries()) {
    if (group.length > 1) {
      collisions.push({ key, records: group });
    }
  }
  return collisions;
}
