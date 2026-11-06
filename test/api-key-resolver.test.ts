import { Adeli, AuthenticationError, ConfigurationError, TimeoutError, type ApiKey, type ApiKeyResolver } from '../src/index.js';

function response(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function bearer(init: RequestInit | undefined): string | null {
  return new Headers(init?.headers).get('authorization');
}

test('a static string key is unchanged: validated at construction and sent as a bearer token', async () => {
  const sent: (string | null)[] = [];
  const client = new Adeli({ apiKey: 'static-key', fetch: async (_input, init) => { sent.push(bearer(init)); return response(200, {}); } });
  await client.getMe();
  expect(sent).toEqual(['Bearer static-key']);
  expect(() => new Adeli({ apiKey: '' })).toThrow(ConfigurationError);
  expect(() => new Adeli({ apiKey: '   ' })).toThrow(ConfigurationError);
  expect(() => new Adeli({ apiKey: 'bad\nkey' })).toThrow(ConfigurationError);
});

test('a resolver is not called at construction and is called once per request, never cached', async () => {
  let calls = 0;
  const apiKey: ApiKeyResolver = () => `key-${++calls}`;
  const sent: (string | null)[] = [];
  const client = new Adeli({ apiKey, fetch: async (_input, init) => { sent.push(bearer(init)); return response(200, {}); } });
  expect(calls).toBe(0);
  await client.getMe();
  await client.getMe();
  await client.profiles.listProfiles();
  expect(calls).toBe(3);
  expect(sent).toEqual(['Bearer key-1', 'Bearer key-2', 'Bearer key-3']);
});

test('a resolver is called again on every retry attempt, so a retry picks up a rotated key', async () => {
  let calls = 0;
  const statuses = [503, 503, 200];
  const sent: (string | null)[] = [];
  const client = new Adeli({
    apiKey: () => `rotated-${++calls}`,
    maxRetries: 2,
    fetch: async (_input, init) => { sent.push(bearer(init)); return response(statuses.shift()!, {}, { 'retry-after': '0' }); },
  });
  expect((await client.getMe()).status).toBe(200);
  expect(calls).toBe(3);
  expect(sent).toEqual(['Bearer rotated-1', 'Bearer rotated-2', 'Bearer rotated-3']);
});

test('an async resolver works', async () => {
  const apiKey: ApiKey = async () => { await new Promise((resolve) => setTimeout(resolve, 1)); return 'async-key'; };
  let sent: string | null = null;
  const client = new Adeli({ apiKey, fetch: async (_input, init) => { sent = bearer(init); return response(200, {}); } });
  await client.getMe();
  expect(sent).toBe('Bearer async-key');
});

test('a resolver takes precedence over ADELI_API_KEY', async () => {
  const previous = process.env.ADELI_API_KEY;
  process.env.ADELI_API_KEY = 'env-key';
  try {
    let sent: string | null = null;
    const client = new Adeli({ apiKey: () => 'resolved-key', fetch: async (_input, init) => { sent = bearer(init); return response(200, {}); } });
    await client.getMe();
    expect(sent).toBe('Bearer resolved-key');
  } finally {
    if (previous === undefined) delete process.env.ADELI_API_KEY;
    else process.env.ADELI_API_KEY = previous;
  }
});

test('an empty, blank, non-string, or invalid resolved value is a ConfigurationError before fetch, never retried or echoed', async () => {
  for (const value of ['', '   ', 'synthetic-secret\u0000', 'synthetic-secret\r\n', 'synthetic-secretĀ', undefined, 42]) {
    let calls = 0;
    let fetches = 0;
    const client = new Adeli({ apiKey: () => { calls++; return value as string; }, maxRetries: 3, fetch: async () => { fetches++; return response(200, {}); } });
    const error: unknown = await client.getMe().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConfigurationError);
    expect((error as Error).message).not.toContain('synthetic-secret');
    expect(calls).toBe(1);
    expect(fetches).toBe(0);
  }
});

test('a throwing or rejecting resolver surfaces a ConfigurationError with the cause and is not retried', async () => {
  const cause = new Error('vault unavailable');
  for (const apiKey of [() => { throw cause; }, () => Promise.reject(cause)] satisfies ApiKeyResolver[]) {
    let calls = 0;
    let fetches = 0;
    const client = new Adeli({ apiKey: () => { calls++; return apiKey(); }, maxRetries: 3, fetch: async () => { fetches++; return response(200, {}); } });
    const error: unknown = await client.getMe().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConfigurationError);
    expect((error as Error).message).toBe('The Adeli API key resolver failed');
    expect((error as Error).cause).toBe(cause);
    expect(calls).toBe(1);
    expect(fetches).toBe(0);
  }
});

test('a resolver that never settles is bounded by the request deadline', async () => {
  const client = new Adeli({ apiKey: () => new Promise<string>(() => undefined), timeoutMs: 20, fetch: async () => response(200, {}) });
  await expect(client.getMe()).rejects.toBeInstanceOf(TimeoutError);
});

test('the resolved key never appears in a serialized client or an API error', async () => {
  const secret = 'synthetic-resolved-secret';
  const client = new Adeli({
    apiKey: () => secret,
    fetch: async () => response(401, { error: { code: secret, message: `bad key ${secret}`, details: { [secret]: [secret] } } }),
  });
  expect(JSON.stringify(client)).toBe('{}');
  expect(JSON.stringify({ client })).not.toContain(secret);
  const error: unknown = await client.getMe().catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(AuthenticationError);
  expect(error).toMatchObject({ code: '[REDACTED]', message: 'bad key [REDACTED]', details: { '[REDACTED]': ['[REDACTED]'] } });
  expect(JSON.stringify(error)).not.toContain(secret);
  expect(String(error)).not.toContain(secret);
});

test('redaction uses the key sent on that attempt, not an earlier one', async () => {
  let calls = 0;
  const client = new Adeli({
    apiKey: () => `attempt-secret-${++calls}`,
    fetch: async (_input, init) => {
      const key = bearer(init)!.slice('Bearer '.length);
      return response(400, { error: { code: 'invalid_request', message: `echo ${key}`, details: { key } } });
    },
  });
  await client.getMe().catch(() => undefined);
  const error: unknown = await client.getMe().catch((caught: unknown) => caught);
  expect(error).toMatchObject({ message: 'echo [REDACTED]', details: { key: '[REDACTED]' } });
});
