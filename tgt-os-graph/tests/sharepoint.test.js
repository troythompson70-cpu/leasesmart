import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSharePointProof,
  driveItemCanonicalKey,
  normalizeDriveItem,
  reconcileSharePointDelta,
} from '../src/sharepoint.js';

describe('SHAREPOINT_ID_TEST', () => {
  it('uses driveId:itemId as canonical identity across rename/path change', () => {
    const a = normalizeDriveItem({
      id: 'item-1',
      name: 'feed.json',
      eTag: 'etag-1',
      webUrl: 'https://tgttechnologies.sharepoint.com/feed.json',
      parentReference: { driveId: 'drive-A', id: 'parent-1', path: '/drive/root:/General' },
    });
    const renamed = normalizeDriveItem({
      id: 'item-1',
      name: 'feed-renamed.json',
      eTag: 'etag-2',
      webUrl: 'https://tgttechnologies.sharepoint.com/feed-renamed.json',
      parentReference: { driveId: 'drive-A', id: 'parent-2', path: '/drive/root:/Archive' },
    });
    assert.equal(driveItemCanonicalKey(a), driveItemCanonicalKey(renamed));
    assert.notEqual(a.path, renamed.path);
  });

  it('buildSharePointProof requires itemId + etag/hash + webUrl', () => {
    const ok = buildSharePointProof({
      driveId: 'd',
      itemId: 'i',
      parentId: null,
      name: 'n',
      path: 'p',
      lastModifiedDateTime: null,
      eTag: 'e',
      cTag: null,
      webUrl: 'https://example.sharepoint.com/x',
    });
    assert.equal(ok.state, 'VERIFIED');
    const bad = buildSharePointProof({
      driveId: 'd',
      itemId: 'i',
      parentId: null,
      name: 'n',
      path: 'p',
      lastModifiedDateTime: null,
      eTag: null,
      cTag: null,
      webUrl: null,
    });
    assert.equal(bad.state, 'BLOCKED');
  });
});

describe('SHAREPOINT_DELTA_TEST', () => {
  it('persists delta link and upserts identities', async () => {
    const links = new Map();
    const ids = new Map();
    const state = {
      async getDeltaLink(k) {
        return links.get(k) || null;
      },
      async setDeltaLink(k, v) {
        links.set(k, v);
      },
      async upsertIdentity(_k, identity) {
        ids.set(driveItemCanonicalKey(identity), identity);
      },
    };
    const client = {
      async get() {
        return {
          value: [
            {
              id: 'item-9',
              name: 'TGT_DASHBOARD_FEED.json',
              eTag: 'etag',
              webUrl: 'https://tgttechnologies.sharepoint.com/feed',
              parentReference: { driveId: 'drive-1', id: 'p' },
            },
          ],
          '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/sp-delta',
        };
      },
    };
    const result = await reconcileSharePointDelta(client, {
      driveId: 'drive-1',
      state,
    });
    assert.equal(result.count, 1);
    assert.equal(ids.has('drive-1:item-9'), true);
    assert.equal(links.get('sp-delta:drive-1:root'), 'https://graph.microsoft.com/v1.0/sp-delta');
  });
});
