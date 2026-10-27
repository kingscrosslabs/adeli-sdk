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
  let uploadUrl = '';
  const server = createServer((request, response) => {
    if (request.url === '/api/v1/media/uploads') {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const manifest = JSON.parse(Buffer.concat(chunks).toString()) as { files: Array<{ clientId: string; contentType: string }> };
        response.writeHead(201, { 'content-type': 'application/json' }).end(JSON.stringify({ uploads: manifest.files.map((file) => ({ clientId: file.clientId, uploadId: 'staged', method: 'PUT', url: uploadUrl, headers: { 'content-type': file.contentType }, expiresAt: '2026-10-26T12:00:00Z' })) }));
      });
      return;
    }
    request.on('data', (chunk: Buffer) => {
      received += chunk.byteLength;
      request.pause();
      setTimeout(() => request.resume(), 8);
    });
    request.on('end', () => { complete = true; response.writeHead(200).end(); });
    request.on('aborted', () => { request.destroy(); closeRequest?.(); });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('upload receiver did not bind');
  uploadUrl = `http://127.0.0.1:${address.port}/s3`;
  const controller = new AbortController();
  const client = new Adeli({ apiKey: 'upload-test-key', baseURL: `http://127.0.0.1:${address.port}` });
  try {
    const file = await fileFromPath(path, { contentType: 'video/mp4' });
    const upload = kind === 'youtube'
      ? client.posts.uploadYouTubeVideo({ body: { accountId: id, profileId: id, video: file, title: 'cancel', privacy_status: 'private', made_for_kids: false } }, { signal: deadline === 'signal' ? controller.signal : undefined, timeoutMs: deadline === 'timeout' ? 80 : 5_000 })
      : client.posts.createPost({ body: { platform: 'tiktok', accountId: id, profileId: id, video: file, music_usage_confirmed: true } }, { signal: deadline === 'signal' ? controller.signal : undefined, timeoutMs: deadline === 'timeout' ? 80 : 5_000 });
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
] as const)('cancels %s direct S3 upload during streaming via %s', async (kind, deadline) => {
  await abortDuringFileUpload(kind, deadline);
});

test('retries an idempotent presigned PUT without retrying initiation or publication', async () => {
  let initiation = 0; let puts = 0; let publication = 0;
  const client = new Adeli({ apiKey: 'key', baseURL: 'https://api.example', maxRetries: 1, fetch: async (input, init) => {
    const request = new Request(input, init); const url = new URL(request.url);
    if (url.pathname === '/api/v1/media/uploads') { initiation++; return new Response(JSON.stringify({ uploads: [{ clientId: '0', uploadId: 'staged', method: 'PUT', url: 'https://s3.example/object', headers: { 'content-type': 'image/jpeg' }, expiresAt: '2026-10-26T12:00:00Z' }] }), { status: 201, headers: { 'content-type': 'application/json' } }); }
    if (url.hostname === 's3.example') { puts++; return new Response('', { status: puts === 1 ? 503 : 200 }); }
    publication++; return new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } });
  } });
  await client.posts.createPost({ body: { platform: 'facebook', accountId: id, profileId: id, image: new File(['image'], 'bird.jpg', { type: 'image/jpeg' }) } });
  expect({ initiation, puts, publication }).toEqual({ initiation: 1, puts: 2, publication: 1 });
});
