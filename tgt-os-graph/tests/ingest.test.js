import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  atomicCapture,
  captureWithReplayGuard,
  createMemoryProcessedStore,
  idempotencyKey,
} from '../src/ingest.js';
import { normalizeOutlookMessage } from '../src/outlook.js';

const msg = normalizeOutlookMessage({
  id: 'IMMUTABLE-NINJA-001',
  internetMessageId: '<nid@exchangelabs.com>',
  subject: 'NinjaOne',
  from: { emailAddress: { address: 'Max.Farrell@ninjaone.com', name: 'Max' } },
  receivedDateTime: '2026-09-15T15:59:35Z',
  body: { content: 'hello' },
  bodyPreview: 'hello',
});

function adapters(visible = true) {
  let writes = 0;
  return {
    writes: () => writes,
    async writeCanonical(n) {
      writes += 1;
      return { id: `canon-${n.graphMessageId}` };
    },
    async ingestCommandCenter(canonical) {
      return { id: `rec-${canonical.id}` };
    },
    async readBackVisible(ingested) {
      return { visible, record: ingested };
    },
  };
}

describe('DEDUPE_TEST / REPLAY_TEST', () => {
  it('prefers graph id then internetMessageId then hash', () => {
    assert.equal(idempotencyKey({ graphMessageId: 'g1' }), 'graph:g1');
    assert.equal(idempotencyKey({ internetMessageId: '<a@b>' }), 'imid:<a@b>');
    assert.equal(idempotencyKey({ contentHash: 'abc' }), 'hash:abc');
  });

  it('replay after success yields creates=0', async () => {
    const store = createMemoryProcessedStore();
    const a = adapters(true);
    const result = await captureWithReplayGuard(store, msg, a);
    assert.equal(result.first.creates, 1);
    assert.equal(result.replayCreates, 0);
    assert.equal(result.replayZeroDuplicate, true);
    assert.equal(a.writes(), 1);
  });
});

describe('ATOMIC_CAPTURE_TEST / VISIBLE_READBACK_TEST', () => {
  it('does not mark CAPTURED_VISIBLE without readback', async () => {
    const store = createMemoryProcessedStore();
    const result = await atomicCapture(store, msg, adapters(false));
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'VISIBLE_READBACK_FAILED');
    const prior = await store.get(idempotencyKey(msg));
    assert.notEqual(prior.phase, 'CAPTURED_VISIBLE');
  });

  it('completes full transaction when readback visible', async () => {
    const store = createMemoryProcessedStore();
    const result = await atomicCapture(store, msg, adapters(true));
    assert.equal(result.ok, true);
    assert.equal(result.phase, 'CAPTURED_VISIBLE');
  });
});

describe('RESTART_PERSISTENCE_TEST', () => {
  it('durable store prevents duplicate creates after process restart simulation', async () => {
    const shared = createMemoryProcessedStore();
    const a1 = adapters(true);
    await atomicCapture(shared, msg, a1);
    // Simulate restart: new adapters, same durable store.
    const a2 = adapters(true);
    const again = await atomicCapture(shared, msg, a2);
    assert.equal(again.creates, 0);
    assert.equal(again.duplicate, true);
    assert.equal(a2.writes(), 0);
  });
});

describe('ORPHAN_RECOVERY_TEST', () => {
  it('same internetMessageId without graph id still dedupes', async () => {
    const store = createMemoryProcessedStore();
    const withoutGraph = { ...msg, graphMessageId: null, outlookItemId: null };
    const a = adapters(true);
    const first = await atomicCapture(store, withoutGraph, a);
    const second = await atomicCapture(store, withoutGraph, a);
    assert.equal(first.creates, 1);
    assert.equal(second.creates, 0);
  });
});
