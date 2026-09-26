/**
 * Outlook reconciliation: ImmutableId preference, delta sync, lifecycle handling.
 * Webhook receipt is NOT the sole source of truth — delta recovery is required.
 */

import { createHash } from 'node:crypto';

/** Hard hold — never automate outbound involving these parties. */
export const CISCO_JARED_HARD_HOLD = Object.freeze({
  addresses: Object.freeze(['jmillika@cisco.com', 'msp@cisco.com']),
  domains: Object.freeze(['cisco.com']),
  note: 'READ_ONLY — no send/reply/forward/draft automation',
});

/**
 * @param {string|undefined|null} address
 */
export function isCiscoJaredHardHold(address) {
  const a = String(address || '').trim().toLowerCase();
  if (!a) return false;
  if (CISCO_JARED_HARD_HOLD.addresses.includes(a)) return true;
  return CISCO_JARED_HARD_HOLD.domains.some((d) => a === d || a.endsWith(`@${d}`));
}

/**
 * Prefer Immutable Graph id; fall back carefully.
 * @param {object} msg Graph message
 */
export function stableMessageIdentity(msg) {
  const immutableOrId = String(msg?.id || '').trim();
  const internetMessageId = String(msg?.internetMessageId || '').trim();
  return {
    graphMessageId: immutableOrId || null,
    internetMessageId: internetMessageId || null,
    conversationId: msg?.conversationId ? String(msg.conversationId) : null,
  };
}

/**
 * Normalize a Graph message into a canonical capture payload (no secrets).
 * @param {object} msg
 * @param {{ mailbox?: string }} [meta]
 */
export function normalizeOutlookMessage(msg, meta = {}) {
  const ids = stableMessageIdentity(msg);
  const fromAddress =
    msg?.from?.emailAddress?.address ||
    msg?.sender?.emailAddress?.address ||
    '';
  const bodyContent =
    typeof msg?.body?.content === 'string'
      ? msg.body.content
      : typeof msg?.body === 'string'
        ? msg.body
        : '';
  const bodyPreview = String(msg?.bodyPreview || '').trim();
  const textBody = stripHtml(bodyContent).trim() || bodyPreview;

  const payload = {
    source: 'outlook',
    mailSource: 'outlook',
    mailbox: meta.mailbox || null,
    graphMessageId: ids.graphMessageId,
    internetMessageId: ids.internetMessageId,
    conversationId: ids.conversationId,
    outlookItemId: ids.graphMessageId,
    subject: String(msg?.subject || '').trim(),
    fromAddress: String(fromAddress).trim().toLowerCase(),
    fromName: String(msg?.from?.emailAddress?.name || '').trim(),
    receivedDateTime: msg?.receivedDateTime || null,
    sentDateTime: msg?.sentDateTime || null,
    isRead: Boolean(msg?.isRead),
    webLink: msg?.webLink || null,
    bodyText: textBody,
    hardHold: isCiscoJaredHardHold(fromAddress),
    contentHash: hashPayload({
      internetMessageId: ids.internetMessageId,
      subject: msg?.subject,
      fromAddress,
      receivedDateTime: msg?.receivedDateTime,
      bodyText: textBody,
    }),
  };
  return payload;
}

/**
 * @param {string} html
 */
export function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ');
}

function hashPayload(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

/**
 * Durable delta state store interface (inject persistence).
 * @typedef {object} DeltaStateStore
 * @property {(key: string) => Promise<string|null>} getDeltaLink
 * @property {(key: string, link: string) => Promise<void>} setDeltaLink
 */

/**
 * Run Outlook message delta reconciliation for a user mailbox.
 * @param {import('./client.js').GraphClient} client
 * @param {object} opts
 * @param {string} opts.userId user principal or id (app-only)
 * @param {DeltaStateStore} opts.state
 * @param {string} [opts.stateKey]
 * @param {(msg: object) => Promise<void>|void} [opts.onMessage]
 */
export async function reconcileOutlookDelta(client, opts) {
  const stateKey = opts.stateKey || `outlook-delta:${opts.userId}`;
  const saved = await opts.state.getDeltaLink(stateKey);
  let url = saved
    ? saved
    : `/users/${encodeURIComponent(opts.userId)}/mailFolders/inbox/messages/delta?$select=id,internetMessageId,conversationId,subject,from,sender,receivedDateTime,sentDateTime,bodyPreview,body,isRead,webLink`;

  const seen = [];
  // Guard against runaway pages.
  for (let page = 0; page < 100; page++) {
    const data = await client.get(url, { preferImmutableId: true });
    const values = Array.isArray(data?.value) ? data.value : [];
    for (const msg of values) {
      if (msg['@removed']) continue;
      const normalized = normalizeOutlookMessage(msg, { mailbox: opts.userId });
      seen.push(normalized);
      if (opts.onMessage) await opts.onMessage(normalized);
    }
    if (data?.['@odata.nextLink']) {
      url = data['@odata.nextLink'];
      continue;
    }
    if (data?.['@odata.deltaLink']) {
      await opts.state.setDeltaLink(stateKey, data['@odata.deltaLink']);
    }
    break;
  }
  return { messages: seen, count: seen.length, stateKey };
}

/**
 * Handle Graph change-notification lifecycle events.
 * @param {'missed'|'subscriptionRemoved'|'reauthorizationRequired'|string} lifecycleEvent
 * @param {{ reconcile: () => Promise<unknown>, recreateSubscription?: () => Promise<unknown>, reauthorize?: () => Promise<'ok'|'OWNER_ACTION_REQUIRED: MICROSOFT_ADMIN_CONSENT'> }} handlers
 */
export async function handleOutlookLifecycle(lifecycleEvent, handlers) {
  switch (lifecycleEvent) {
    case 'missed':
      await handlers.reconcile();
      return { action: 'reconcile', ok: true };
    case 'subscriptionRemoved':
      if (handlers.recreateSubscription) await handlers.recreateSubscription();
      await handlers.reconcile();
      return { action: 'recreate_and_reconcile', ok: true };
    case 'reauthorizationRequired': {
      if (!handlers.reauthorize) {
        return {
          action: 'blocked',
          ok: false,
          code: 'OWNER_ACTION_REQUIRED: MICROSOFT_ADMIN_CONSENT',
        };
      }
      const result = await handlers.reauthorize();
      if (result !== 'ok') {
        return { action: 'blocked', ok: false, code: result };
      }
      await handlers.reconcile();
      return { action: 'reauthorized_and_reconciled', ok: true };
    }
    default: {
      const _exhaustive = lifecycleEvent;
      return {
        action: 'ignored_unknown',
        ok: false,
        code: `UNKNOWN_LIFECYCLE:${String(_exhaustive)}`,
      };
    }
  }
}
