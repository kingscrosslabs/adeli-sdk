import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Adeli, CancellationError, TimeoutError } from '../src/index.js';
import type { CreateAdAccountBody } from '../src/resources/ads.js';
import { blobFromPath, fileFromPath } from '../src/uploads.js';

const id = '00000000-0000-0000-0000-000000000001';

test('preserves URL media without fetching the media URL and supports upload adapters', async () => {
  const root = await mkdtemp(join(tmpdir(), 'adeli-adapters-'));
  try {
    const path = join(root, 'source.bin');
    await writeFile(path, 'source');
    const blob = await blobFromPath(path, { contentType: 'application/octet-stream' });
    const renamed = await fileFromPath(path, { name: 'renamed.bin', contentType: 'application/x-custom' });
    expect(blob.type).toBe('application/octet-stream');
    expect(await blob.text()).toBe('source');
    expect(renamed.name).toBe('renamed.bin');
    expect(renamed.type).toBe('application/x-custom');
    await expect(fileFromPath(join(root, 'missing.bin'))).rejects.toThrow();

    const calls: string[] = [];
    let body: Record<string, unknown> | undefined;
    const client = new Adeli({ apiKey: 'key', baseURL: 'http://localhost', fetch: async (input, init) => {
      calls.push(String(input));
      body = JSON.parse(await new Request(input, init).text()) as Record<string, unknown>;
      return new Response(JSON.stringify({ status: 'published', posts: [], errors: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    } });
    await client.posts.createPost({ body: { platform: 'youtube', accountId: id, title: 'URL', privacy_status: 'private', made_for_kids: false, video: { url: 'https://media.example/video.mp4' } } });
    expect(calls).toHaveLength(1);
    expect(body?.video).toEqual({ url: 'https://media.example/video.mp4' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects all invalid idempotency header values before fetch', async () => {
  let calls = 0;
  const client = new Adeli({ apiKey: 'key', baseURL: 'http://localhost', fetch: async () => { calls++; return new Response('{}'); } });
  const body: CreateAdAccountBody = { businessId: 'business', name: 'Ads', timezone: 'UTC' };
  for (const idempotencyKey of ['', '  ', `bad${String.fromCharCode(10)}key`, `bad${String.fromCharCode(0)}key`]) {
    expect(() => client.ads.createAdAccount({ body }, { idempotencyKey })).toThrow(TypeError);
  }
  await expect(client.ads.createAdAccount({ body }, { idempotencyKey: 'unicode-😀' })).rejects.toBeInstanceOf(TypeError);
  expect(calls).toBe(0);
});

type UploadKind = 'youtube' | 'tiktok';
async function abortDuringFileUpload(kind: UploadKind, deadline: 'signal' | 'timeout'): Promise<{ received: number; complete: boolean; fileSize: number }> {
  const root = await mkdtemp(join(tmpdir(), `adeli-${kind}-cancel-`));
  const path = join(root, `${kind}.mp4`);
  const fileSize = 8 * 1024 * 1024;
  await writeFile(path, '');
  await truncate(path, fileSize);
  let received = 0;
  let complete = false;
  let closeRequest: (() => void) | undefined;
  const server = createServer((request, response) => {
    request.on('data', (chunk: Buffer) => {
      received += chunk.byteLength;
      request.pause();
      setTimeout(() => request.resume(), 8);
    });
    request.on('end', () => { complete = true; response.writeHead(200, { 'content-type': 'application/json' }).end('{}'); });
    request.on('aborted', () => { request.destroy(); closeRequest?.(); });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('upload receiver did not bind');
  const controller = new AbortController();
  const client = new Adeli({ apiKey: 'upload-test-key', baseURL: `http://127.0.0.1:${address.port}` });
  try {
    const file = await fileFromPath(path, { contentType: 'video/mp4' });
    const upload = kind === 'youtube'
      ? client.posts.uploadYouTubeVideo({ body: { accountId: id, video: file, title: 'cancel', privacy_status: 'private', made_for_kids: false } }, { signal: deadline === 'signal' ? controller.signal : undefined, timeoutMs: deadline === 'timeout' ? 80 : 5_000 })
      : client.posts.createPost({ body: { platform: 'tiktok', accountId: id, video: file, music_usage_confirmed: true } }, { signal: deadline === 'signal' ? controller.signal : undefined, timeoutMs: deadline === 'timeout' ? 80 : 5_000 });
    const abortTimer = setInterval(() => {
      if (received >= 128 * 1024) {
        clearInterval(abortTimer);
        if (deadline === 'signal') controller.abort();
      }
    }, 2);
    try {
      if (deadline === 'signal') await expect(upload).rejects.toBeInstanceOf(CancellationError);
      else await expect(upload).rejects.toBeInstanceOf(TimeoutError);
    } finally {
      clearInterval(abortTimer);
    }
    expect(received).toBeGreaterThan(0);
    expect(received).toBeLessThan(fileSize);
    expect(complete).toBe(false);
    return { received, complete, fileSize };
  } finally {
    await new Promise<void>((resolve) => {
      closeRequest = resolve;
      server.close(() => resolve());
      server.closeAllConnections?.();
    });
    await rm(root, { recursive: true, force: true });
  }
}

test.each([
  ['youtube', 'signal'], ['tiktok', 'signal'], ['youtube', 'timeout'], ['tiktok', 'timeout'],
] as const)('cancels %s file-backed multipart upload during streaming via %s', async (kind, deadline) => {
  await abortDuringFileUpload(kind, deadline);
});
