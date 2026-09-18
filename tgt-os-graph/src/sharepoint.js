/**
 * SharePoint / OneDrive reconciliation — IDs are canonical; paths are display.
 */

/**
 * @typedef {object} DriveItemIdentity
 * @property {string} driveId
 * @property {string} itemId
 * @property {string|null} parentId
 * @property {string|null} name
 * @property {string|null} path
 * @property {string|null} lastModifiedDateTime
 * @property {string|null} eTag
 * @property {string|null} cTag
 * @property {string|null} webUrl
 */

/**
 * @param {object} item Graph driveItem
 * @param {{ driveId?: string }} [ctx]
 * @returns {DriveItemIdentity|null}
 */
export function normalizeDriveItem(item, ctx = {}) {
  const itemId = String(item?.id || '').trim();
  if (!itemId) return null;
  const driveId =
    String(ctx.driveId || item?.parentReference?.driveId || item?.driveId || '').trim() || null;
  if (!driveId) return null;

  return {
    driveId,
    itemId,
    parentId: item?.parentReference?.id ? String(item.parentReference.id) : null,
    name: item?.name ? String(item.name) : null,
    path: item?.parentReference?.path
      ? `${item.parentReference.path}/${item.name || ''}`
      : item?.name
        ? String(item.name)
        : null,
    lastModifiedDateTime: item?.lastModifiedDateTime || null,
    eTag: item?.eTag || null,
    cTag: item?.cTag || null,
    webUrl: item?.webUrl || null,
  };
}

/**
 * Dedupe key for Command Center objects — ID based, not path.
 * @param {DriveItemIdentity} identity
 */
export function driveItemCanonicalKey(identity) {
  return `${identity.driveId}:${identity.itemId}`;
}

/**
 * @typedef {object} SpDeltaStateStore
 * @property {(key: string) => Promise<string|null>} getDeltaLink
 * @property {(key: string, link: string) => Promise<void>} setDeltaLink
 * @property {(key: string, identity: DriveItemIdentity) => Promise<void>} [upsertIdentity]
 */

/**
 * Delta reconcile a drive root or folder.
 * @param {import('./client.js').GraphClient} client
 * @param {object} opts
 * @param {string} opts.driveId
 * @param {string} [opts.itemId] folder item id; omit for drive root
 * @param {SpDeltaStateStore} opts.state
 * @param {string} [opts.stateKey]
 * @param {(identity: DriveItemIdentity) => Promise<void>|void} [opts.onItem]
 */
export async function reconcileSharePointDelta(client, opts) {
  const stateKey =
    opts.stateKey ||
    `sp-delta:${opts.driveId}:${opts.itemId || 'root'}`;
  const saved = await opts.state.getDeltaLink(stateKey);
  let url =
    saved ||
    (opts.itemId
      ? `/drives/${encodeURIComponent(opts.driveId)}/items/${encodeURIComponent(opts.itemId)}/delta`
      : `/drives/${encodeURIComponent(opts.driveId)}/root/delta`);

  /** @type {import('./sharepoint.js').DriveItemIdentity[]} */
  const items = [];
  for (let page = 0; page < 100; page++) {
    const data = await client.get(url, { preferImmutableId: false });
    const values = Array.isArray(data?.value) ? data.value : [];
    for (const raw of values) {
      if (raw['@removed']) continue;
      const identity = normalizeDriveItem(raw, { driveId: opts.driveId });
      if (!identity) continue;
      items.push(identity);
      if (opts.state.upsertIdentity) await opts.state.upsertIdentity(stateKey, identity);
      if (opts.onItem) await opts.onItem(identity);
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
  return { items, count: items.length, stateKey };
}

/**
 * SharePoint proof shape expected by TGT OS UI (`sharePointProof`).
 * @param {DriveItemIdentity} identity
 * @param {{ hash?: string }} [extra]
 */
export function buildSharePointProof(identity, extra = {}) {
  const hash = extra.hash || identity.eTag || identity.cTag || null;
  const ok = Boolean(identity.itemId && (identity.eTag || hash) && identity.webUrl);
  return {
    state: ok ? 'VERIFIED' : 'BLOCKED',
    itemId: identity.itemId,
    driveId: identity.driveId,
    eTag: identity.eTag,
    cTag: identity.cTag,
    hash,
    webUrl: identity.webUrl,
    reason: ok ? 'Graph drive item read-back matched.' : 'Missing itemId, etag/hash, or webUrl.',
  };
}
