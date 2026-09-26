/**
 * Graph change-notification validation + subscription repair.
 * Webhook receipt is never the sole source of truth — always reconcile delta.
 */

import { handleOutlookLifecycle } from './outlook.js';

/**
 * Validate Graph subscription handshake.
 * When Graph sends validationToken as query param, echo it as plain text.
 * @param {{ validationToken?: string|null, clientState?: string|null, expectedClientState?: string|null }} input
 */
export function validateNotificationHandshake(input) {
  const token = input?.validationToken != null ? String(input.validationToken) : '';
  if (token) {
    return { ok: true, status: 200, contentType: 'text/plain', body: token };
  }
  return { ok: false, status: 400, contentType: 'text/plain', body: 'missing validationToken' };
}

/**
 * Validate notification clientState and classify payload.
 * @param {object} body Graph notifications JSON
 * @param {{ expectedClientState: string }} opts
 */
export function validateNotificationPayload(body, opts) {
  const expected = String(opts.expectedClientState || '');
  const notifications = Array.isArray(body?.value) ? body.value : [];
  if (!notifications.length) {
    return { ok: false, reason: 'EMPTY_NOTIFICATIONS', lifecycle: [], change: [] };
  }

  /** @type {object[]} */
  const lifecycle = [];
  /** @type {object[]} */
  const change = [];

  for (const n of notifications) {
    const state = n.clientState != null ? String(n.clientState) : '';
    if (expected && state !== expected) {
      return { ok: false, reason: 'CLIENT_STATE_MISMATCH', lifecycle: [], change: [] };
    }
    if (n.lifecycleEvent) {
      lifecycle.push(n);
    } else {
      change.push(n);
    }
  }
  return { ok: true, reason: null, lifecycle, change };
}

/**
 * Process a notification batch: lifecycle first, then signal delta reconcile for changes.
 * Does not trust webhook alone — always schedules reconcile for change notifications.
 *
 * @param {object} body
 * @param {object} opts
 * @param {string} opts.expectedClientState
 * @param {() => Promise<unknown>} opts.reconcile
 * @param {() => Promise<unknown>} [opts.recreateSubscription]
 * @param {() => Promise<'ok'|'OWNER_ACTION_REQUIRED: MICROSOFT_ADMIN_CONSENT'>} [opts.reauthorize]
 */
export async function processOutlookNotifications(body, opts) {
  const validated = validateNotificationPayload(body, {
    expectedClientState: opts.expectedClientState,
  });
  if (!validated.ok) {
    return { ok: false, reason: validated.reason, actions: [] };
  }

  /** @type {object[]} */
  const actions = [];
  for (const n of validated.lifecycle) {
    const result = await handleOutlookLifecycle(String(n.lifecycleEvent), {
      reconcile: opts.reconcile,
      recreateSubscription: opts.recreateSubscription,
      reauthorize: opts.reauthorize,
    });
    actions.push({ type: 'lifecycle', event: n.lifecycleEvent, result });
  }

  if (validated.change.length) {
    await opts.reconcile();
    actions.push({ type: 'change', count: validated.change.length, result: { action: 'reconcile', ok: true } });
  }

  return { ok: true, reason: null, actions };
}

/**
 * Create or renew a Graph mail subscription (app-only).
 * @param {import('./client.js').GraphClient} client
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.notificationUrl HTTPS endpoint
 * @param {string} opts.clientState
 * @param {string} [opts.subscriptionId] renew existing when set
 * @param {number} [opts.minutes] expiration window (max ~4230 for mail)
 */
export async function ensureMailSubscription(client, opts) {
  const minutes = Math.min(Math.max(opts.minutes || 4230, 60), 4230);
  const expirationDateTime = new Date(Date.now() + minutes * 60_000).toISOString();
  const resource = `users/${opts.userId}/mailFolders('inbox')/messages`;

  if (opts.subscriptionId) {
    return client.request(`/subscriptions/${encodeURIComponent(opts.subscriptionId)}`, {
      method: 'PATCH',
      preferImmutableId: false,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expirationDateTime }),
    });
  }

  return client.post(
    '/subscriptions',
    {
      changeType: 'created,updated',
      notificationUrl: opts.notificationUrl,
      resource,
      expirationDateTime,
      clientState: opts.clientState,
      latestSupportedTlsVersion: 'v1_2',
    },
    { preferImmutableId: false },
  );
}

/**
 * Factory used by lifecycle `recreateSubscription` handler.
 * @param {import('./client.js').GraphClient} client
 * @param {object} opts same as ensureMailSubscription (without subscriptionId)
 * @param {{ getSubscriptionId: () => Promise<string|null>, setSubscriptionId: (id: string) => Promise<void> }} store
 */
export async function recreateMailSubscription(client, opts, store) {
  const existing = await store.getSubscriptionId();
  // Always create fresh after subscriptionRemoved — do not PATCH a deleted id.
  void existing;
  const created = await ensureMailSubscription(client, { ...opts, subscriptionId: undefined });
  if (created?.id) await store.setSubscriptionId(String(created.id));
  return created;
}
