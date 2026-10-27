import { mkdtemp, rm, truncate, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Adeli } from '../src/index.js';
import { fileFromPath } from '../src/uploads.js';

const mode = process.argv[2] === 'eager' ? 'eager' : 'stream';
const fixtureSize = 256 * 1024 * 1024;
const memory = () => { const value = process.memoryUsage(); return { rss: value.rss, external: value.external, arrayBuffers: value.arrayBuffers }; };
const root = await mkdtemp(join(tmpdir(), 'adeli-memory-worker-'));
const path = join(root, 'sparse.mp4');
let server: ReturnType<typeof createServer> | undefined;
try {
  await writeFile(path, '');
  await truncate(path, fixtureSize);
  let received = 0;
  let chunks = 0;
  let uploadUrl = '';
  server = createServer((request, response) => {
    if (request.url === '/api/v1/media/uploads') {
      const body: Buffer[] = [];
      request.on('data', (chunk: Buffer) => body.push(chunk));
      request.on('end', () => {
        const manifest = JSON.parse(Buffer.concat(body).toString()) as { files: Array<{ clientId: string; contentType: string }> };
        response.writeHead(201, { 'content-type': 'application/json' }).end(JSON.stringify({ uploads: manifest.files.map((file) => ({ clientId: file.clientId, uploadId: 'staged', method: 'PUT', url: uploadUrl, headers: { 'content-type': file.contentType }, expiresAt: '2026-10-26T12:00:00Z' })) }));
      });
      return;
    }
    const direct = request.url === '/s3';
    request.on('data', (chunk: Buffer) => {
      if (direct) received += chunk.byteLength;
      chunks += 1;
      if (chunks % 16 === 0) { request.pause(); setTimeout(() => request.resume(), 20); }
    });
    request.on('end', () => { response.writeHead(200, { 'content-type': 'application/json' }).end(direct ? '' : '{}'); });
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('memory receiver did not bind');
  uploadUrl = `http://127.0.0.1:${address.port}/s3`;
  let eagerBuffer: Buffer | undefined;
  const baseline = memory();
  const samples = [baseline];
  const sampler = setInterval(() => samples.push(memory()), 10);
  try {
    const upload = mode === 'eager'
      ? (eagerBuffer = await readFile(path), new File([eagerBuffer], 'eager.mp4', { type: 'video/mp4' }))
      : await fileFromPath(path, { contentType: 'video/mp4' });
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => { const target = new URL(String(input)); if (target.hostname !== '127.0.0.1') throw new Error(`outbound fetch blocked: ${target}`); return realFetch(input, { ...init, redirect: 'error' }); };
    const client = new Adeli({ apiKey: 'memory-test-key', baseURL: `http://127.0.0.1:${address.port}` });
    await client.posts.uploadYouTubeVideo({ body: { accountId: '00000000-0000-0000-0000-000000000001', profileId: '00000000-0000-0000-0000-000000000001', video: upload, title: 'memory', privacy_status: 'private', made_for_kids: false } });
  } finally {
    clearInterval(sampler);
  }
  samples.push(memory());
  const rssDelta = Math.max(...samples.map((sample) => sample.rss)) - baseline.rss;
  const externalDelta = Math.max(...samples.map((sample) => sample.external)) - baseline.external;
  const arrayBuffersDelta = Math.max(...samples.map((sample) => sample.arrayBuffers)) - baseline.arrayBuffers;
  process.stdout.write(JSON.stringify({ mode, fixtureSize, received, rssDelta, externalDelta, arrayBuffersDelta }) + '\n');
  void eagerBuffer;
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  await rm(root, { recursive: true, force: true });
}
