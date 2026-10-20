import { Adeli, CancellationError, MalformedResponseError, NetworkError, RedirectError, TimeoutError } from '../src/index.js';
import { resolveConfig } from '../src/core/config.js';
import { backoffMs, parseRetryAfter } from '../src/core/retry.js';
import { Transport } from '../src/core/transport.js';
import type { OperationMetadata } from '../src/core/types.js';
import { vi } from 'vitest';

const safeRead: OperationMetadata = { operationId: 'fixtureRead', method: 'GET', path: '/fixture/{id}', retry: 'safe-read' };
const write: OperationMetadata = { operationId: 'fixtureWrite', method: 'POST', path: '/fixture', retry: 'never' };
const defaultLongRead: OperationMetadata = { operationId: 'fixtureLongRead', method: 'GET', path: '/fixture', retry: 'safe-read', defaultTimeoutMs: 300_000 };

function jsonResponse(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function makeTransport(fetch: typeof globalThis.fetch, options: { maxRetries?: number; timeoutMs?: number } = {}) {
  return new Transport(resolveConfig({ apiKey: 'key', fetch, ...options }));
}

test('test harness fails closed for outbound provider requests', async () => {
  await expect(globalThis.fetch('https://app.tryadeli.com/api/v1/me')).rejects.toThrow('Network access is disabled in tests');
});

test('serializes path/query boundaries and rejects dot segments', async () => {
  let seen: Request | undefined;
  const transport = makeTransport(async (input, init) => {
    seen = new Request(input, init);
    return jsonResponse(200, { ok: true });
  });
  await transport.request({ operation: safeRead, path: { id: 'a/b' }, query: { falseValue: false, zeroValue: 0, omitted: undefined } });
  expect(seen?.url).toContain('/api/v1/fixture/a%2Fb?falseValue=false&zeroValue=0');
  await expect(transport.request({ operation: safeRead, path: { id: '.' } })).rejects.toThrow('dot segments');
  await expect(transport.request({ operation: safeRead, path: { id: '..' } })).rejects.toThrow('dot segments');
});

test('validates per-call timer boundaries before fetch', async () => {
  let calls = 0;
  const transport = makeTransport(async () => { calls++; return jsonResponse(200, {}); });
  await expect(transport.request({ operation: safeRead, path: { id: 'overflow' }, timeoutMs: 2_147_483_648 })).rejects.toThrow('no greater than 2147483647ms');
  expect(calls).toBe(0);
  await expect(transport.request({ operation: safeRead, path: { id: 'at-limit' }, timeoutMs: 2_147_483_647 })).resolves.toMatchObject({ status: 200 });
  expect(calls).toBe(1);
});

test('rejects empty successful responses and preserves multipart boundary ownership', async () => {
  const empty = makeTransport(async () => new Response(null, { status: 200 }));
  await expect(empty.request({ operation: safeRead, path: { id: 'empty' } })).rejects.toBeInstanceOf(MalformedResponseError);

  let seen: Request | undefined;
  const transport = makeTransport(async (input, init) => {
    seen = new Request(input, init);
    return jsonResponse(201, { accepted: true });
  });
  const form = new FormData();
  form.append('enabled', 'false');
  form.append('count', '0');
  await transport.request({ operation: write, body: form });
  expect(seen?.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/);
  expect(await seen?.clone().text()).toContain('enabled');
});

test('refuses redirects without retrying and does not retry 207 responses', async () => {
  let redirectCalls = 0;
  const redirect = makeTransport(async () => {
    redirectCalls++;
    const redirected = new Response('{}', { status: 200 });
    Object.defineProperty(redirected, 'redirected', { value: true });
    return redirected;
  }, { maxRetries: 3 });
  await expect(redirect.request({ operation: safeRead, path: { id: 'redirect' } })).rejects.toBeInstanceOf(RedirectError);
  expect(redirectCalls).toBe(1);

  let partialCalls = 0;
  const partial = makeTransport(async () => {
    partialCalls++;
    return jsonResponse(207, { status: 'partial', records: [], errors: [] });
  }, { maxRetries: 3 });
  await expect(partial.request({ operation: safeRead, path: { id: 'partial' } })).resolves.toMatchObject({ status: 207 });
  expect(partialCalls).toBe(1);
});

test('wraps response stream failures as network errors and cancels stalled readers', async () => {
  const failedBody = makeTransport(async () => new Response(new ReadableStream({ start(controller) { controller.error(new TypeError('connection terminated')); } }), { status: 200 }));
  await expect(failedBody.request({ operation: safeRead, path: { id: 'failed-body' } })).rejects.toBeInstanceOf(NetworkError);

  let cancelled = false;
  const stalledBody = makeTransport(async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 200 }));
  const controller = new AbortController();
  const request = stalledBody.request({ operation: safeRead, path: { id: 'stalled-body' }, signal: controller.signal });
  await Promise.resolve();
  controller.abort();
  await expect(request).rejects.toBeInstanceOf(CancellationError);
  expect(cancelled).toBe(true);
});

test('does not retry local serialization failures and keeps idempotency key stable', async () => {
  let calls = 0;
  const transport = makeTransport(async () => { calls++; return jsonResponse(200, {}); }, { maxRetries: 3 });
  await expect(transport.request({ operation: write, body: BigInt(1) })).rejects.toBeInstanceOf(TypeError);
  expect(calls).toBe(0);

  vi.useFakeTimers();
  try {
    const headers: string[] = [];
    let attempts = 0;
    const client = new Adeli({ apiKey: 'key', maxRetries: 1, fetch: async (input, init) => {
      headers.push(new Request(input, init).headers.get('idempotency-key') ?? '');
      attempts++;
      return attempts === 1 ? jsonResponse(503, {}, { 'retry-after': '0' }) : jsonResponse(201, { id: 'profile-1' });
    } });
    const result = client.profiles.createProfile({ body: { name: 'Acme' } }, { idempotencyKey: 'stable-key' });
    await vi.runAllTimersAsync();
    await expect(result).resolves.toMatchObject({ status: 201 });
    expect(headers).toEqual(['stable-key', 'stable-key']);
  } finally {
    vi.useRealTimers();
  }
});

test('parses Retry-After forms, computes bounded backoff, and stops when delay exceeds the deadline', async () => {
  expect(backoffMs(0, undefined, 0)).toBe(250);
  expect(backoffMs(1, undefined, 0)).toBe(500);
  expect(backoffMs(20, undefined, 0)).toBe(30_000);
  expect(parseRetryAfter('1', 1_000)).toBe(1_000);
  const date = new Date(10_000).toUTCString();
  expect(parseRetryAfter(date, 1_000)).toBe(Date.parse(date) - 1_000);
  expect(parseRetryAfter('not-a-delay', 1_000)).toBeUndefined();

  let calls = 0;
  const transport = makeTransport(async () => {
    calls++;
    return jsonResponse(503, { error: { code: 'temporarily_unavailable', message: 'try later' } }, { 'retry-after': '60' });
  }, { maxRetries: 1 });
  await expect(transport.request({ operation: safeRead, path: { id: 'deadline' }, timeoutMs: 10 })).rejects.toMatchObject({ status: 503 });
  expect(calls).toBe(1);
});

test('cancels retry backoff without issuing another attempt', async () => {
  let calls = 0;
  const transport = makeTransport(async () => {
    calls++;
    return jsonResponse(503, { error: { code: 'temporarily_unavailable', message: 'try later' } });
  }, { maxRetries: 1 });
  const controller = new AbortController();
  const request = transport.request({ operation: safeRead, path: { id: 'backoff' }, signal: controller.signal });
  const assertion = expect(request).rejects.toBeInstanceOf(CancellationError);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(calls).toBe(1);
  controller.abort();
  await assertion;
  expect(calls).toBe(1);
});

test('honors per-call, client, operation, and ordinary 60-second deadlines', async () => {
  vi.useFakeTimers();
  try {
    let aborted = false;
    const clientTimeout = makeTransport(async (_input, init) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => { aborted = true; reject(new DOMException('aborted', 'AbortError')); }, { once: true });
    }), { timeoutMs: 20 });
    const clientRequest = clientTimeout.request({ operation: defaultLongRead });
    const clientTimeoutExpectation = expect(clientRequest).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(19);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await clientTimeoutExpectation;

    aborted = false;
    const perCallRequest = clientTimeout.request({ operation: defaultLongRead, timeoutMs: 5 });
    const perCallTimeoutExpectation = expect(perCallRequest).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(4);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await perCallTimeoutExpectation;

    aborted = false;
    const ordinary = makeTransport(async (_input, init) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => { aborted = true; reject(new DOMException('aborted', 'AbortError')); }, { once: true });
    }));
    const ordinaryRequest = ordinary.request({ operation: safeRead, path: { id: 'ordinary' } });
    const ordinaryTimeoutExpectation = expect(ordinaryRequest).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await ordinaryTimeoutExpectation;
  } finally {
    vi.useRealTimers();
  }
});
