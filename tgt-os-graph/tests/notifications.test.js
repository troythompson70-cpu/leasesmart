import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  processOutlookNotifications,
  recreateMailSubscription,
  validateNotificationHandshake,
  validateNotificationPayload,
} from '../src/notifications.js';

describe('NOTIFICATION_VALIDATION', () => {
  it('echoes validationToken for Graph handshake', () => {
    const res = validateNotificationHandshake({ validationToken: 'abc-123' });
    assert.equal(res.status, 200);
    assert.equal(res.body, 'abc-123');
    assert.equal(res.contentType, 'text/plain');
  });

  it('rejects clientState mismatch', () => {
    const bad = validateNotificationPayload(
      { value: [{ clientState: 'wrong', resource: 'users/x/messages/1' }] },
      { expectedClientState: 'expected' },
    );
    assert.equal(bad.ok, false);
    assert.equal(bad.reason, 'CLIENT_STATE_MISMATCH');
  });
});

describe('LIFECYCLE_VIA_NOTIFICATIONS', () => {
  it('missed and change both drive reconcile; subscriptionRemoved recreates', async () => {
    const log = [];
    const body = {
      value: [
        { clientState: 'tgt', lifecycleEvent: 'missed' },
        { clientState: 'tgt', lifecycleEvent: 'subscriptionRemoved' },
        { clientState: 'tgt', resource: 'users/u/messages/1', changeType: 'created' },
      ],
    };
    const result = await processOutlookNotifications(body, {
      expectedClientState: 'tgt',
      async reconcile() {
        log.push('reconcile');
      },
      async recreateSubscription() {
        log.push('recreate');
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(log, ['reconcile', 'recreate', 'reconcile', 'reconcile']);
  });

  it('reauthorizationRequired without recovery emits admin consent blocker', async () => {
    const result = await processOutlookNotifications(
      { value: [{ clientState: 'tgt', lifecycleEvent: 'reauthorizationRequired' }] },
      {
        expectedClientState: 'tgt',
        async reconcile() {},
      },
    );
    assert.equal(result.ok, true);
    assert.equal(result.actions[0].result.code, 'OWNER_ACTION_REQUIRED: MICROSOFT_ADMIN_CONSENT');
  });
});

describe('SUBSCRIPTION_RECREATE', () => {
  it('creates subscription and persists id', async () => {
    let saved = null;
    const client = {
      async post(path, body) {
        assert.equal(path, '/subscriptions');
        assert.equal(body.clientState, 'tgt-state');
        assert.match(body.resource, /mailFolders\('inbox'\)\/messages/);
        return { id: 'sub-99', expirationDateTime: body.expirationDateTime };
      },
      async request() {
        throw new Error('should create not patch after removal');
      },
    };
    const store = {
      async getSubscriptionId() {
        return 'old-deleted';
      },
      async setSubscriptionId(id) {
        saved = id;
      },
    };
    const created = await recreateMailSubscription(
      client,
      {
        userId: 'tgates@tgttechnologies.com',
        notificationUrl: 'https://example.invalid/hooks/graph',
        clientState: 'tgt-state',
      },
      store,
    );
    assert.equal(created.id, 'sub-99');
    assert.equal(saved, 'sub-99');
  });
});
