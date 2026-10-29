import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type MemoryReport = { mode: string; fixtureSize: number; received: number; rssDelta: number; externalDelta: number; arrayBuffersDelta: number };
async function runWorker(mode: 'stream' | 'eager'): Promise<MemoryReport> {
  const worker = fileURLToPath(new URL('./upload-memory-worker.ts', import.meta.url));
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', worker, mode], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let errors = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`memory worker timed out: ${errors}`)); }, 30_000);
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { errors += chunk.toString(); });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) { reject(new Error(`memory worker ${mode} exited ${code}: ${errors}\n${output}`)); return; }
      try { resolve(JSON.parse(output.trim()) as MemoryReport); }
      catch (error) { reject(new Error(`invalid memory worker output: ${String(error)}\n${output}\n${errors}`)); }
    });
  });
}

test('file-backed multipart remains bounded while eager buffering is detectable', { timeout: 45_000 }, async () => {
  const streaming = await runWorker('stream');
  expect(streaming.received).toBeGreaterThanOrEqual(streaming.fixtureSize);
  // undici/fetch RSS includes runtime allocator pages beyond the upload buffers;
  // external/ArrayBuffer deltas remain the bounded payload signal below.
  expect(streaming.rssDelta).toBeLessThan(192 * 1024 * 1024);
  expect(streaming.externalDelta).toBeLessThan(128 * 1024 * 1024);
  expect(streaming.arrayBuffersDelta).toBeLessThan(128 * 1024 * 1024);
  const eager = await runWorker('eager');
  expect(eager.received).toBeGreaterThanOrEqual(eager.fixtureSize);
  expect(Math.max(eager.rssDelta, eager.externalDelta, eager.arrayBuffersDelta)).toBeGreaterThan(128 * 1024 * 1024);
});
