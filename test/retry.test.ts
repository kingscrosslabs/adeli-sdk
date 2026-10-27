import { Adeli } from '../src/index.js';

const ok = () => new Response(JSON.stringify({ id: 'p' }), { status: 200, headers: { 'content-type': 'application/json' } });

test('does not retry by default and retries safe reads only when opted in', async () => {
  let calls = 0;
  const noRetry = new Adeli({ apiKey: 'k', fetch: async () => { calls++; return new Response('{}', { status: 503 }); } });
  await expect(noRetry.getMe()).rejects.toMatchObject({ status: 503 });
  expect(calls).toBe(1);
  calls = 0;
  const retry = new Adeli({ apiKey: 'k', maxRetries: 1, fetch: async () => { calls++; return calls === 1 ? new Response('{}', { status: 503 }) : ok(); } });
  await expect(retry.getMe()).resolves.toMatchObject({ status: 200 });
  expect(calls).toBe(2);
});

test('quota exhaustion is never retried', async () => {
  let calls = 0;
  const client = new Adeli({ apiKey: 'k', maxRetries: 3, fetch: async () => {
    calls++;
    return new Response(JSON.stringify({ error: { code: 'quota_exhausted', message: 'Quota exhausted' } }), { status: 429 });
  } });
  await expect(client.getMe()).rejects.toMatchObject({ status: 429, code: 'quota_exhausted' });
  expect(calls).toBe(1);
});

test('profile create requires idempotency before retrying', async () => {
  let calls = 0;
  const client = new Adeli({ apiKey: 'k', maxRetries: 1, fetch: async () => { calls++; return new Response('{}', { status: 503 }); } });
  await expect(client.profiles.createProfile({ body: { name: 'a' } })).rejects.toMatchObject({ status: 503 });
  expect(calls).toBe(1);
  calls = 0;
  await expect(client.profiles.createProfile({ body: { name: 'a' } }, { idempotencyKey: 'x' })).rejects.toMatchObject({ status: 503 });
  expect(calls).toBe(2);
});
