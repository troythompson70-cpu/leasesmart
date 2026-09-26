import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  handleOutlookLifecycle,
  isCiscoJaredHardHold,
  normalizeOutlookMessage,
  reconcileOutlookDelta,
} from '../src/outlook.js';

const CISCO_FIXTURE = {
  id: 'IMMUTABLE-CISCO-001',
  internetMessageId: '<P67YN5Z09YM_6aad0bfd9f1cb_1b230be1a71b08_sprut@zendesk.com>',
  conversationId: 'conv-cisco',
  subject: 'Duo Security: 1st Reminder of your Support Request 2179189',
  from: { emailAddress: { name: 'Cisco Secure MSP Center', address: 'msp@cisco.com' } },
  receivedDateTime: '2026-09-18T10:01:40Z',
  body: { contentType: 'html', content: '<p>Reminder body</p>' },
  bodyPreview: 'Reminder body',
  webLink: 'https://outlook.office.com/mail/deeplink/read/IMMUTABLE-CISCO-001',
};

const NINJA_FIXTURE = {
  id: 'IMMUTABLE-NINJA-001',
  internetMessageId: '<IA0PR01MB8237EBF013D4FE32822F28D58BBA2@IA0PR01MB8237.prod.exchangelabs.com>',
  subject: 'Re: [EXTERNAL] RE: Troy | NinjaOne Overview — Move Meeting to Next Week',
  from: { emailAddress: { name: 'Max Farrell', address: 'Max.Farrell@ninjaone.com' } },
  receivedDateTime: '2026-09-15T15:59:35Z',
  bodyPreview: 'time slots',
  body: { content: 'time slots proposed' },
};

const PCMATIC_FIXTURE = {
  id: 'IMMUTABLE-PCM-001',
  internetMessageId: '<CAGpSwxKFt9gy+O5wrVydh4Twn5jgkqKj_cHCZMWODPC1XGV0mA@mail.gmail.com>',
  subject: 'Re: TGT Technologies Inc. — MSP NFR / 60-Day Evaluation Qualification',
  from: { emailAddress: { name: 'Sylvanus Mensah', address: 'smensah@pcmatic.com' } },
  receivedDateTime: '2026-09-16T02:23:15Z',
  bodyPreview: 'PC Matic evaluation',
  body: { content: 'PC Matic evaluation' },
};

describe('CISCO_HARD_HOLD_TEST', () => {
  it('marks Cisco/Jared traffic as hard-hold read-only', () => {
    assert.equal(isCiscoJaredHardHold('jmillika@cisco.com'), true);
    assert.equal(isCiscoJaredHardHold('msp@cisco.com'), true);
    assert.equal(isCiscoJaredHardHold('Max.Farrell@ninjaone.com'), false);
    const n = normalizeOutlookMessage(CISCO_FIXTURE);
    assert.equal(n.hardHold, true);
    assert.equal(n.graphMessageId, 'IMMUTABLE-CISCO-001');
  });
});

describe('OUTLOOK_DELTA_TEST', () => {
  it('persists deltaLink and normalizes messages', async () => {
    /** @type {Map<string,string>} */
    const links = new Map();
    const state = {
      async getDeltaLink(k) {
        return links.get(k) || null;
      },
      async setDeltaLink(k, v) {
        links.set(k, v);
      },
    };

    let calls = 0;
    const client = {
      async get(url) {
        calls += 1;
        if (calls === 1) {
          assert.match(String(url), /delta/);
          return {
            value: [CISCO_FIXTURE, NINJA_FIXTURE, PCMATIC_FIXTURE],
            '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/delta-next',
          };
        }
        return { value: [], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/delta-next' };
      },
    };

    const first = await reconcileOutlookDelta(client, {
      userId: 'tgates@tgttechnologies.com',
      state,
    });
    assert.equal(first.count, 3);
    assert.equal(links.size, 1);

    const second = await reconcileOutlookDelta(client, {
      userId: 'tgates@tgttechnologies.com',
      state,
    });
    assert.equal(second.count, 0);
    assert.equal(calls, 2);
    assert.equal(
      links.get('outlook-delta:tgates@tgttechnologies.com'),
      'https://graph.microsoft.com/v1.0/delta-next',
    );
  });
});

describe('LIFECYCLE_TEST', () => {
  it('missed → reconcile; subscriptionRemoved → recreate+reconcile; reauth blocked without handler', async () => {
    const log = [];
    const handlers = {
      async reconcile() {
        log.push('reconcile');
      },
      async recreateSubscription() {
        log.push('recreate');
      },
    };

    assert.equal((await handleOutlookLifecycle('missed', handlers)).ok, true);
    assert.deepEqual(log, ['reconcile']);

    log.length = 0;
    assert.equal((await handleOutlookLifecycle('subscriptionRemoved', handlers)).ok, true);
    assert.deepEqual(log, ['recreate', 'reconcile']);

    const blocked = await handleOutlookLifecycle('reauthorizationRequired', handlers);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, 'OWNER_ACTION_REQUIRED: MICROSOFT_ADMIN_CONSENT');
  });
});
