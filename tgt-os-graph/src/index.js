export {
  GraphCredentialError,
  GraphTokenProvider,
  loadGraphCredentials,
} from './auth.js';

export {
  GraphClient,
  GraphHttpError,
  backoffMs,
  withImmutableIdPrefer,
} from './client.js';

export {
  CISCO_JARED_HARD_HOLD,
  handleOutlookLifecycle,
  isCiscoJaredHardHold,
  normalizeOutlookMessage,
  reconcileOutlookDelta,
  stableMessageIdentity,
  stripHtml,
} from './outlook.js';

export {
  buildSharePointProof,
  driveItemCanonicalKey,
  normalizeDriveItem,
  reconcileSharePointDelta,
} from './sharepoint.js';

export {
  CAPTURE_PHASES,
  atomicCapture,
  captureWithReplayGuard,
  createMemoryProcessedStore,
  idempotencyKey,
} from './ingest.js';

export {
  ensureMailSubscription,
  processOutlookNotifications,
  recreateMailSubscription,
  validateNotificationHandshake,
  validateNotificationPayload,
} from './notifications.js';