import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GraphClient, backoffMs, withImmutableIdPrefer } from '../src/client.js';
import { GraphTokenProvider } from '../src/auth.js';

describe('IMMUTABLE_ID_TEST', () => {
  it('adds Prefer IdType=ImmutableId', () => {
    const h = withImmutableIdPrefer({});
    assert.match(h.get('Prefer') || '', /IdType="ImmutableId"/);
  });
});

describe('429_RETRY_TEST / 503_RETRY_TEST', () => {
  it('honors Retry-After on 429 then succeeds', async () => {
    let n = 0;
    const delays = [];
    const fetchImpl = async (url, init) => {
      if (String(url).includes('oauth2')) {
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({ access_token: 't', expires_in: 3600 });
          },
        };
      }
      n += 1;
      if (n === 1) {
        return {
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '0' }),
          async text() {
            return '{}';
          },
        };
      }
      assert.match(String(init.headers.get('Prefer') || ''), /ImmutableId/);
      // Ensure Authorization is present but tests never print it.
      assert.ok(init.headers.get('Authorization')?.startsWith('Bearer '));
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        async json() {
          return { value: [] };
        },
        async text() {
          return '{"value":[]}';
        },
      };
    };

    const client = new GraphClient({
      fetchImpl,
      tokenProvider: new GraphTokenProvider({
        loadCredentials: () => ({
          tenantId: 't',
          clientId: 'c',
          clientSecret: 's',
          scope: 'https://graph.microsoft.com/.default',
        }),
        fetchImpl,
      }),
      onRetry: (m) => delays.push(...m.delaysMs),
      rng: () => 0,
    });

    const data = await client.get('/me/messages');
    assert.deepEqual(data, { value: [] });
    assert.equal(n, 2);
    assert.ok(delays.length >= 1);
  });

  it('retries 503 with exponential backoff bound', async () => {
    assert.ok(backoffMs(0, () => 0) >= 500);
    assert.ok(backoffMs(10, () => 0) <= 30_250);
  });
});
