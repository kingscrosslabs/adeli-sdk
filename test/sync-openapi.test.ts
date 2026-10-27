import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const tsx = resolve('node_modules/tsx/dist/cli.mjs');
const script = resolve('scripts/sync-openapi.ts');

const validDocument = {
  openapi: '3.1.0',
  info: { title: 'Candidate API', version: '0.1.0' },
  paths: {
    '/ping': {
      get: {
        operationId: 'ping',
        responses: { '200': { description: 'OK' } },
      },
    },
  },
};

async function runSync(cwd: string, source: string, ...extra: string[]) {
  return execFile(process.execPath, [tsx, script, '--file', source, ...extra], { cwd });
}

test('sync validates before replacing the snapshot and writes safe labeled provenance', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'adeli-sync-'));
  try {
    await mkdir(join(directory, 'openapi'));
    const candidate = join(directory, 'candidate.json');
    const bytes = Buffer.from(`${JSON.stringify(validDocument, null, 2)}\n`);
    await writeFile(candidate, bytes);
    await runSync(directory, candidate, '--source-label', 'adeli-core-working-tree');

    expect(await readFile(join(directory, 'openapi/adeli.openapi.json'))).toEqual(bytes);
    const provenance = JSON.parse(await readFile(join(directory, 'openapi/provenance.json'), 'utf8')) as Record<string, unknown>;
    expect(provenance.source).toBe('adeli-core-working-tree');
    expect(provenance.status).toBe('candidate-unreleased');
    expect(provenance.upstreamCommit).toBeNull();
    expect(provenance.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(JSON.stringify(provenance)).not.toContain(directory);

    await writeFile(join(directory, 'openapi/adeli.openapi.json'), 'sentinel');
    await writeFile(join(directory, 'invalid.json'), JSON.stringify({ openapi: '3.1.0', info: validDocument.info, paths: {} }));
    await expect(runSync(directory, join(directory, 'invalid.json'))).rejects.toBeTruthy();
    expect(await readFile(join(directory, 'openapi/adeli.openapi.json'), 'utf8')).toBe('sentinel');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('sync rejects unresolved references before writing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'adeli-sync-'));
  try {
    await mkdir(join(directory, 'openapi'));
    const candidate = join(directory, 'invalid-ref.json');
    await writeFile(candidate, JSON.stringify({
      ...validDocument,
      paths: { '/ping': { get: { operationId: 'ping', responses: { '200': { $ref: '#/components/responses/Missing' } } } } },
      components: { responses: {} },
    }));
    await expect(runSync(directory, candidate)).rejects.toBeTruthy();
    expect(await readFile(join(directory, 'openapi/adeli.openapi.json')).catch(() => null)).toBeNull();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
