import { Adeli, CancellationError, ConfigurationError, MalformedResponseError } from '../src/index.js';

function response(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(status === 204 || body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

test('sends auth, escapes paths and preserves false/zero query values', async () => {
  let seen: Request | undefined;
  const client = new Adeli({ apiKey: 'secret', baseURL: 'http://localhost:3000', fetch: async (input, init) => { seen = new Request(input, init); return response(200, { ok: true }); } });
  await client.accounts.listAccounts({ query: { profileId: 'a/b', accountId: 'account', platform: 'x' } });
  expect(seen?.url).toContain('/api/v1/accounts?profileId=a%2Fb&accountId=account&platform=x');
  expect(seen?.headers.get('authorization')).toBe('Bearer secret');
  expect(seen?.redirect).toBe('error');
});

test('does not call fetch for an already-aborted request', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const client = new Adeli({ apiKey: 'key', fetch: async () => { calls++; return response(200, {}); } });
  await expect(client.getMe({}, { signal: controller.signal })).rejects.toBeInstanceOf(CancellationError);
  expect(calls).toBe(0);
});

test('accepts 202 and 207 and returns undefined for 204', async () => {
  const statuses = [202, 207, 204];
  const client = new Adeli({ apiKey: 'key', fetch: async () => response(statuses.shift()!, { result: 'ok' }) });
  expect((await client.getMe()).status).toBe(202);
  expect((await client.getMe()).status).toBe(207);
  expect((await client.profiles.deleteProfile({ path: { profileId: 'p' } })).data).toBeUndefined();
});

test('protects JSON content type and profile idempotency key', async () => {
  let seen: Request | undefined;
  const client = new Adeli({ apiKey: 'key', fetch: async (input, init) => { seen = new Request(input, init); return response(201, { id: 'p', name: 'x' }); } });
  await client.profiles.createProfile({ body: { name: 'x' } }, { idempotencyKey: 'stable' });
  expect(seen?.headers.get('content-type')).toBe('application/json');
  expect(seen?.headers.get('idempotency-key')).toBe('stable');
  expect(await seen?.json()).toEqual({ name: 'x' });
});

test('rejects ambiguous base URLs and malformed successful JSON', async () => {
  expect(() => new Adeli({ apiKey: 'key', baseURL: 'https://example.test/api/v1' })).toThrow(ConfigurationError);
  const client = new Adeli({ apiKey: 'key', fetch: async () => new Response('{bad', { status: 200 }) });
  await expect(client.getMe()).rejects.toBeInstanceOf(MalformedResponseError);
});

test('validates client timer boundaries before fetch', async () => {
  let calls = 0;
  expect(() => new Adeli({ apiKey: 'key', timeoutMs: 2_147_483_648, fetch: async () => { calls++; return response(200, {}); } })).toThrow(ConfigurationError);
  expect(calls).toBe(0);
  const atLimit = new Adeli({ apiKey: 'key', timeoutMs: 2_147_483_647, fetch: async () => { calls++; return response(200, {}); } });
  await expect(atLimit.getMe()).resolves.toMatchObject({ status: 200 });
  expect(calls).toBe(1);
});
