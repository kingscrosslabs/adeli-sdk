import { Adeli, AuthenticationError, CancellationError, ConfigurationError, TimeoutError, ValidationError, isPermissionRequiredDetails, type PermissionRequiredDetails } from '../src/index.js';

test('recognizes sparse and full permission details without modifying them', () => {
  const sparse: PermissionRequiredDetails = Object.freeze({ reconnect: Object.freeze({ action: 'restart_oauth' }) });
  expect(isPermissionRequiredDetails(sparse)).toBe(true);
  const rich: unknown = Object.freeze({ provider: 'youtube', capability: 'publish', missingPermissions: Object.freeze([{ code: 'scope', label: 'Upload' }]), reconnect: Object.freeze({ action: 'restart_oauth', method: 'POST', href: null, provider: 'youtube' }), future: { unchanged: true } });
  const before = JSON.stringify(rich);
  expect(isPermissionRequiredDetails(rich)).toBe(true);
  if (isPermissionRequiredDetails(rich)) expect(rich.missingPermissions?.[0]?.code).toBe('scope');
  expect(JSON.stringify(rich)).toBe(before);
});

test('does not assume unknown or malformed error details are permission guidance', () => {
  for (const value of [null, [], 'error', {}, { unknown: true }, { accountId: undefined }, { provider: 'google_business_profile' }, { missingPermissions: ['scope'] }, { missingResources: [{ code: 'page' }] }, { reconnect: {} }, { reconnect: { action: 'restart_oauth', method: 'GET' } }, { reconnect: { action: 'restart_oauth', href: 42 } }]) {
    expect(isPermissionRequiredDetails(value)).toBe(false);
  }
  const malformed = { get provider(): never { throw new Error('unreadable'); } };
  expect(() => isPermissionRequiredDetails(malformed)).not.toThrow();
  expect(isPermissionRequiredDetails(malformed)).toBe(false);
});

test('rejects invalid header credentials without echoing them', () => {
  for (const suffix of ['\u0000', '\u0001', '\u007f', '\u0100']) {
    const secret = `synthetic-secret${suffix}`;
    expect(() => new Adeli({ apiKey: secret })).toThrow(ConfigurationError);
    expect(() => new Adeli({ apiKey: secret })).not.toThrow('synthetic-secret');
  }
});

test('preserves explicit null error details and redacts reflected codes and keys', async () => {
  const secret = 'synthetic-reflected-secret';
  const nullDetails = new Adeli({ apiKey: secret, fetch: async () => new Response(JSON.stringify({ error: { code: 'invalid_request', message: 'Invalid', details: null } }), { status: 400 }) });
  await expect(nullDetails.getMe()).rejects.toMatchObject({ details: null });
  const reflected = new Adeli({ apiKey: secret, fetch: async () => new Response(JSON.stringify({ error: { code: secret, message: secret, details: { [secret]: [secret] } } }), { status: 502 }) });
  const error: unknown = await reflected.getMe().catch((value: unknown) => value);
  expect(error).toBeInstanceOf(Error);
  expect(error).toMatchObject({ code: '[REDACTED]', details: { '[REDACTED]': ['[REDACTED]'] } });
  expect(JSON.stringify(error)).not.toContain(secret);
});

test('maps API statuses and preserves structured error details', async () => {
  const client = new Adeli({ apiKey: 'key', fetch: async () => new Response(JSON.stringify({ error: { code: 'invalid_request', message: 'Nope', details: [{ field: 'name' }] } }), { status: 400, headers: { 'x-request-id': 'safe-id' } }) });
  await expect(client.getMe()).rejects.toMatchObject({ status: 400, code: 'invalid_request', details: [{ field: 'name' }] });
  await expect(client.getMe()).rejects.toBeInstanceOf(ValidationError);
});

test('preserves unknown error codes while redacting only secrets', async () => {
  const client = new Adeli({ apiKey: 'secret', fetch: async () => new Response(JSON.stringify({ error: { code: 'future_provider_code', message: 'Try later' } }), { status: 499 }) });
  await expect(client.getMe()).rejects.toMatchObject({ code: 'future_provider_code' });
});

test('distinguishes cancellation and timeout', async () => {
  const cancellation = new AbortController();
  const client = new Adeli({ apiKey: 'key', fetch: (_input, init) => new Promise<Response>((_, reject) => { init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))); }) });
  const cancelled = client.getMe({}, { signal: cancellation.signal }); cancellation.abort();
  await expect(cancelled).rejects.toBeInstanceOf(CancellationError);
  const timed = new Adeli({ apiKey: 'key', timeoutMs: 1, fetch: (_input, init) => new Promise<Response>((_, reject) => { init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))); }) });
  await expect(timed.getMe()).rejects.toBeInstanceOf(TimeoutError);
});

test('redacts credentials from nested API errors and client serialization', async () => {
  const secret = 'do-not-leak';
  const client = new Adeli({ apiKey: secret, fetch: async () => new Response(JSON.stringify({ error: { code: 'provider_error', message: `provider saw ${secret}`, details: { token: secret } } }), { status: 502 }) });
  let error: unknown;
  try { await client.getMe(); } catch (value) { error = value; }
  expect(error).toBeInstanceOf(Error);
  const typed = error as Error & { details?: unknown };
  expect(typed.message).not.toContain(secret);
  expect(JSON.stringify(typed.details)).not.toContain(secret);
  expect(JSON.stringify(client)).toBe('{}');
});

test('uses typed authentication error without exposing credentials in message', async () => {
  const client = new Adeli({ apiKey: 'do-not-leak', fetch: async () => new Response('{}', { status: 401 }) });
  const result = client.getMe();
  await expect(result).rejects.toBeInstanceOf(AuthenticationError);
  await expect(result).rejects.not.toThrow('do-not-leak');
});
