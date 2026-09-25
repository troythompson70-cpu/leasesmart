import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  GraphAuthError,
  __setSecretReaderForTests,
  assertValidGraphTenantId,
  clearGraphTokenCache,
  getGraphAccessToken,
  loadGraphServiceIdentity,
  normalizeGraphTenantId,
  runAuthTest,
} from '../appdeploy/graph-auth.mjs';

const TID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const CID = '11111111-2222-3333-4444-555555555555';

describe('APPDEPLOY_GRAPH_AUTH — no hard-coded identity', () => {
  beforeEach(() => {
    clearGraphTokenCache();
  });

  it('loads tenant, client, and secret only from secret reader', async () => {
    const seen = [];
    __setSecretReaderForTests(async (name) => {
      seen.push(name);
      return {
        GRAPH_TENANT_ID: TID,
        GRAPH_CLIENT_ID: CID,
        GRAPH_CLIENT_SECRET: 'secret-from-store',
      }[name];
    });
    const id = await loadGraphServiceIdentity();
    assert.equal(id.tenantId, TID);
    assert.equal(id.clientId, CID);
    assert.equal(id.clientSecret, 'secret-from-store');
    assert.deepEqual(seen.sort(), [
      'GRAPH_CLIENT_ID',
      'GRAPH_CLIENT_SECRET',
      'GRAPH_TENANT_ID',
    ]);
  });

  it('normalizes braces/quotes/whitespace that cause AADSTS900023', () => {
    assert.equal(normalizeGraphTenantId(`{${TID}}`), TID);
    assert.equal(normalizeGraphTenantId(`"${TID}"`), TID);
    assert.equal(normalizeGraphTenantId(`  ${TID}  `), TID);
    assert.equal(assertValidGraphTenantId(`{${TID}}`), TID);
  });

  it('rejects non-GUID non-domain tenant before calling Microsoft', async () => {
    __setSecretReaderForTests(async (name) => {
      return {
        GRAPH_TENANT_ID: 'not-a-tenant',
        GRAPH_CLIENT_ID: CID,
        GRAPH_CLIENT_SECRET: 'csecret',
      }[name];
    });
    await assert.rejects(
      () => loadGraphServiceIdentity(),
      (err) =>
        err instanceof GraphAuthError &&
        err.code === 'OWNER_ACTION_REQUIRED: GRAPH_TENANT_ID_REPAIR',
    );
  });

  it('AUTH_TEST passes with client_credentials using secret-sourced ids', async () => {
    __setSecretReaderForTests(async (name) => {
      return {
        GRAPH_TENANT_ID: TID,
        GRAPH_CLIENT_ID: CID,
        GRAPH_CLIENT_SECRET: 'csecret',
      }[name];
    });

    let postedClientId = '';
    let postedSecret = '';
    const fetchImpl = async (url, init) => {
      assert.match(
        String(url),
        new RegExp(
          `login\\.microsoftonline\\.com/${TID}/oauth2/v2\\.0/token`,
        ),
      );
      const body = String(init.body);
      postedClientId = new URLSearchParams(body).get('client_id') || '';
      postedSecret = new URLSearchParams(body).get('client_secret') || '';
      assert.equal(new URLSearchParams(body).get('grant_type'), 'client_credentials');
      return {
        ok: true,
        status: 200,
        async json() {
          return { access_token: 'tok-live-abcdefghijklmnop', expires_in: 3600 };
        },
      };
    };

    const result = await runAuthTest({ fetchImpl });
    assert.equal(result.ok, true);
    assert.equal(result.code, 'AUTH_OK');
    assert.equal(postedClientId, CID);
    assert.equal(postedSecret, 'csecret');
  });

  it('maps AADSTS900023 to GRAPH_TENANT_ID_REPAIR', async () => {
    __setSecretReaderForTests(async (name) => {
      return {
        GRAPH_TENANT_ID: TID,
        GRAPH_CLIENT_ID: CID,
        GRAPH_CLIENT_SECRET: 'csecret',
      }[name];
    });
    const fetchImpl = async () => ({
      ok: false,
      status: 400,
      async json() {
        return {
          error: 'invalid_request',
          error_description:
            "AADSTS900023: Specified tenant identifier 'x' is neither a valid DNS name, nor a valid external domain.",
        };
      },
    });
    const result = await runAuthTest({ fetchImpl });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'OWNER_ACTION_REQUIRED: GRAPH_TENANT_ID_REPAIR');
  });

  it('maps AADSTS7000215 to GRAPH_SERVICE_IDENTITY_REPAIR', async () => {
    __setSecretReaderForTests(async (name) => {
      return {
        GRAPH_TENANT_ID: TID,
        GRAPH_CLIENT_ID: CID,
        GRAPH_CLIENT_SECRET: 'wrong-or-mismatched',
      }[name];
    });
    const fetchImpl = async () => ({
      ok: false,
      status: 401,
      async json() {
        return {
          error: 'invalid_client',
          error_description: 'AADSTS7000215: Invalid client secret provided.',
        };
      },
    });
    const result = await runAuthTest({ fetchImpl });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'OWNER_ACTION_REQUIRED: GRAPH_SERVICE_IDENTITY_REPAIR');
  });

  it('caches token and does not re-POST until near expiry', async () => {
    __setSecretReaderForTests(async (name) => {
      return {
        GRAPH_TENANT_ID: TID,
        GRAPH_CLIENT_ID: CID,
        GRAPH_CLIENT_SECRET: 'csecret',
      }[name];
    });
    let calls = 0;
    let now = 1_000_000;
    const fetchImpl = async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return { access_token: 'tok-cached-abcdefghijklmnop', expires_in: 3600 };
        },
      };
    };
    await getGraphAccessToken({ fetchImpl, now: () => now });
    await getGraphAccessToken({ fetchImpl, now: () => now });
    assert.equal(calls, 1);
    now += 3_600_000;
    await getGraphAccessToken({ fetchImpl, now: () => now });
    assert.equal(calls, 2);
  });

  it('fails closed when any of the three secrets is missing', async () => {
    __setSecretReaderForTests(async (name) => {
      if (name === 'GRAPH_CLIENT_SECRET') return '';
      return { GRAPH_TENANT_ID: TID, GRAPH_CLIENT_ID: CID }[name];
    });
    await assert.rejects(
      () => loadGraphServiceIdentity(),
      (err) =>
        err instanceof GraphAuthError &&
        err.code === 'OWNER_ACTION_REQUIRED: GRAPH_CLIENT_SECRET',
    );
  });
});
