/**
 * Atomic Command Center capture + durable idempotency.
 *
 * Transaction:
 * DISCOVERED → CANONICAL_WRITTEN → COMMAND_CENTER_INGESTED → VISIBLE_READBACK → CAPTURED_VISIBLE
 */

/** @typedef {'DISCOVERED'|'CANONICAL_WRITTEN'|'COMMAND_CENTER_INGESTED'|'VISIBLE_READBACK'|'CAPTURED_VISIBLE'} CapturePhase */

export const CAPTURE_PHASES = Object.freeze([
  'DISCOVERED',
  'CANONICAL_WRITTEN',
  'COMMAND_CENTER_INGESTED',
  'VISIBLE_READBACK',
  'CAPTURED_VISIBLE',
]);

/**
 * @typedef {object} ProcessedStore
 * @property {(key: string) => Promise<object|null>} get
 * @property {(key: string, value: object) => Promise<void>} set
 */

/**
 * Build durable idempotency key hierarchy.
 * @param {{ graphMessageId?: string|null, internetMessageId?: string|null, contentHash?: string|null }} ids
 */
export function idempotencyKey(ids) {
  if (ids.graphMessageId) return `graph:${ids.graphMessageId}`;
  if (ids.internetMessageId) return `imid:${ids.internetMessageId}`;
  if (ids.contentHash) return `hash:${ids.contentHash}`;
  return null;
}

/**
 * @param {ProcessedStore} store
 * @param {object} normalized normalizeOutlookMessage output
 * @param {object} adapters
 * @param {(n: object) => Promise<object>} adapters.writeCanonical
 * @param {(canonical: object) => Promise<object>} adapters.ingestCommandCenter
 * @param {(ingested: object) => Promise<{visible: boolean, record?: object}>} adapters.readBackVisible
 */
export async function atomicCapture(store, normalized, adapters) {
  const key = idempotencyKey(normalized);
  if (!key) {
    return {
      ok: false,
      creates: 0,
      phase: null,
      reason: 'NO_STABLE_IDENTITY',
    };
  }

  const prior = await store.get(key);
  if (prior?.phase === 'CAPTURED_VISIBLE') {
    return {
      ok: true,
      creates: 0,
      phase: 'CAPTURED_VISIBLE',
      duplicate: true,
      recordId: prior.recordId || null,
    };
  }

  const discovered = {
    phase: /** @type {CapturePhase} */ ('DISCOVERED'),
    key,
    at: new Date().toISOString(),
    hardHold: Boolean(normalized.hardHold),
  };
  await store.set(key, discovered);

  // Hard hold: still allow read/capture of inbound, never outbound side effects.
  const canonical = await adapters.writeCanonical(normalized);
  await store.set(key, {
    ...discovered,
    phase: 'CANONICAL_WRITTEN',
    canonicalId: canonical?.id || null,
  });

  const ingested = await adapters.ingestCommandCenter(canonical);
  await store.set(key, {
    ...discovered,
    phase: 'COMMAND_CENTER_INGESTED',
    canonicalId: canonical?.id || null,
    recordId: ingested?.id || null,
  });

  const readback = await adapters.readBackVisible(ingested);
  if (!readback?.visible) {
    await store.set(key, {
      ...discovered,
      phase: 'COMMAND_CENTER_INGESTED',
      recordId: ingested?.id || null,
      verificationState: 'BLOCKED',
      reason: 'VISIBLE_READBACK_FAILED',
    });
    return {
      ok: false,
      creates: 1,
      phase: 'COMMAND_CENTER_INGESTED',
      reason: 'VISIBLE_READBACK_FAILED',
      recordId: ingested?.id || null,
    };
  }

  await store.set(key, {
    ...discovered,
    phase: 'CAPTURED_VISIBLE',
    recordId: ingested?.id || readback.record?.id || null,
    verificationState: 'VERIFIED',
  });

  return {
    ok: true,
    creates: 1,
    phase: 'CAPTURED_VISIBLE',
    duplicate: false,
    recordId: ingested?.id || readback.record?.id || null,
  };
}

/**
 * Replay must yield creates=0 after successful capture.
 * @param {ProcessedStore} store
 * @param {object} normalized
 * @param {object} adapters
 */
export async function captureWithReplayGuard(store, normalized, adapters) {
  const first = await atomicCapture(store, normalized, adapters);
  const second = await atomicCapture(store, normalized, adapters);
  return {
    first,
    second,
    replayCreates: second.creates,
    replayZeroDuplicate: second.creates === 0 && second.duplicate === true,
  };
}

/**
 * In-memory processed store for tests / single-process workers.
 * Production must inject durable persistence (DB / AppDeploy store).
 */
export function createMemoryProcessedStore() {
  /** @type {Map<string, object>} */
  const map = new Map();
  return {
    async get(key) {
      return map.get(key) || null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    /** @returns {number} */
    size() {
      return map.size;
    },
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}
