/**
 * Deduplication — never create a second active record for the same thread.
 * Also matches by email domain → company so Contact A → Contact B keeps one company.
 */
import { CLOSED_STATUSES } from './constants.js';
import {
  companyKey as domainCompanyKey,
  extractEmailDomain,
  resolveCompanyFromDomain,
} from './company-domain.js';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^(re|fw|fwd):\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function companyKey(s) {
  return domainCompanyKey(s);
}

function isActive(opp) {
  return !CLOSED_STATUSES.includes(String(opp.status || '').toUpperCase());
}

function candidateDomain(candidate) {
  return (
    extractEmailDomain(
      candidate.email_domain ||
        candidate.from_email ||
        candidate.sender_email ||
        candidate.sender_source ||
        candidate.email ||
        '',
    ) || ''
  );
}

/**
 * Find matching active opportunity before create.
 * Domain alone must NOT merge distinct opportunities at the same company
 * (e.g. Cisco Secure MSP vs Cisco Duo NFR). Prefer thread / bound domain / company+subject.
 * @returns {{ match: object|null, reason: string|null }}
 */
export function findExistingOpportunity(opportunities, candidate, feed = null) {
  const list = (opportunities || []).filter(isActive);
  const cCompany = companyKey(candidate.company || candidate.vendor);
  const cSubject = norm(candidate.thread_subject || candidate.subject);
  const cThread = String(
    candidate.thread_id || candidate.conversation_id || candidate.message_id || '',
  ).trim();
  const cOppId = String(candidate.opportunity_id || candidate.id || '').trim();
  const cDomain = candidateDomain(candidate);
  const resolved = cDomain ? resolveCompanyFromDomain(cDomain, feed) : null;
  const resolvedCompanyKey = resolved ? companyKey(resolved.company) : '';

  // Pass 1 — strong identity keys
  for (const opp of list) {
    if (cOppId && String(opp.opportunity_id || opp.id) === cOppId) {
      return { match: opp, reason: 'opportunity_id' };
    }
    if (
      cThread &&
      (String(opp.thread_id || '') === cThread ||
        String(opp.conversation_id || '') === cThread ||
        String(opp.message_id || '') === cThread ||
        String(opp.source_message_id || '') === cThread)
    ) {
      return { match: opp, reason: 'thread_id' };
    }
  }

  // Pass 2 — domain already bound on the opportunity (Contact A → Contact B same deal)
  if (cDomain) {
    for (const opp of list) {
      const oDomains = [
        ...(opp.domains || []),
        extractEmailDomain(opp.email_domain || ''),
        extractEmailDomain(opp.sender_source || ''),
      ]
        .map((d) => String(d || '').toLowerCase())
        .filter(Boolean);
      if (oDomains.includes(cDomain)) {
        // If subject clearly differs and no shared thread, do not merge distinct deals.
        const oSubject = norm(opp.thread_subject || opp.subject);
        if (cSubject && oSubject && cSubject !== oSubject) {
          const shared =
            cSubject.includes(oSubject.slice(0, 24)) ||
            oSubject.includes(cSubject.slice(0, 24)) ||
            (cSubject.includes('duo') && oSubject.includes('duo')) ||
            (cSubject.includes('msp') && oSubject.includes('msp') && cSubject.includes('nfr') === oSubject.includes('nfr'));
          if (!shared) continue;
        }
        return { match: opp, reason: 'email_domain' };
      }
    }
  }

  // Pass 3 — company + subject / company + thread
  for (const opp of list) {
    const oCompany = companyKey(opp.company || opp.vendor);
    const oSubject = norm(opp.thread_subject || opp.subject);
    const companyMatch =
      (cCompany && oCompany && cCompany === oCompany) ||
      (resolvedCompanyKey && oCompany && resolvedCompanyKey === oCompany);
    if (companyMatch && cSubject && oSubject === cSubject) {
      return { match: opp, reason: 'company+subject' };
    }
    if (companyMatch && cThread) {
      if (
        String(opp.thread_id || '') === cThread ||
        String(opp.conversation_id || '') === cThread
      ) {
        return { match: opp, reason: 'company+thread' };
      }
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
