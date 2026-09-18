import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GraphCredentialError,
  GraphTokenProvider,
  loadGraphCredentials,
} from '../src/auth.js';

describe('AUTH_TEST / loadGraphCredentials', () => {
  it('throws OWNER_ACTION_REQUIRED for each missing secret', () => {
    assert.throws(
      () => loadGraphCredentials({}),
      (err) => err instanceof GraphCredentialError && err.code === 'OWNER_ACTION_REQUIRED: GRAPH_TENANT_ID',
    );
    assert.throws(
      () => loadGraphCredentials({ GRAPH_TENANT_ID: 't' }),
      (err) => err instanceof GraphCredentialError && err.code === 'OWNER_ACTION_REQUIRED: GRAPH_CLIENT_ID',
    );
    assert.throws(
      () => loadGraphCredentials({ GRAPH_TENANT_ID: 't', GRAPH_CLIENT_ID: 'c' }),
      (err) =>
        err instanceof GraphCredentialError && err.code === 'OWNER_ACTION_REQUIRED: GRAPH_CLIENT_SECRET',
    );
  });

  it('loads credentials without exposing them in the thrown path', () => {
    const creds = loadGraphCredentials({
      GRAPH_TENANT_ID: 'tenant-1',
      GRAPH_CLIENT_ID: 'client-1',
      GRAPH_CLIENT_SECRET: 'secret-1',
    });
    assert.equal(creds.tenantId, 'tenant-1');
    assert.equal(creds.scope, 'https://graph.microsoft.com/.default');
  });
});

describe('AUTH_TEST / GraphTokenProvider cache', () => {
  it('caches token until near expiry and does not re-fetch', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ access_token: 'tok-A', expires_in: 3600 });
        },
      };
    };
    let now = 1_000_000;
    const provider = new GraphTokenProvider({
      loadCredentials: () => ({
        tenantId: 't',
        clientId: 'c',
        clientSecret: 's',
        scope: 'https://graph.microsoft.com/.default',
      }),
      fetchImpl,
      now: () => now,
    });

    const a = await provider.getAccessToken();
    const b = await provider.getAccessToken();
    assert.equal(a, 'tok-A');
    assert.equal(b, 'tok-A');
    assert.equal(calls, 1);

    now += 3_600_000; // past expiry skew
    const fetchImpl2 = async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ access_token: 'tok-B', expires_in: 3600 });
        },
      };
    };
    provider.fetchImpl = fetchImpl2;
    const c = await provider.getAccessToken();
    assert.equal(c, 'tok-B');
    assert.equal(calls, 2);
  });
});
