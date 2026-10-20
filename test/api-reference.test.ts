import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { operations } from '../src/operations.js';
import { validateDocsLinks, validateMethodCoverage } from '../scripts/api-reference-validation.js';

test('generated API reference covers every operation with typed escaped signatures and real docs links', async () => {
  const document = await readFile('docs/api-reference.md', 'utf8');
  const rows = document.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| ---'));
  expect(rows).toHaveLength(Object.keys(operations).length + 1); // header plus one row per operation
  expect(document).not.toContain('(... )');
  expect(document).toContain('Promise<ApiResponse');
  expect(document).toContain('CreatePostBody \\| TikTokMultipartBody');
  expect(document).not.toContain('https://www.tryadeli.com/docs/#');
  expect(document).toContain('https://www.tryadeli.com/docs/api/posts/upload-youtube-video-file');
  expect(document).toContain('https://www.tryadeli.com/docs/pricing/x');
});

test('API-reference validation rejects unknown mappings and missing methods', () => {
  const mappings = { getMe: [{ method: 'GET', path: '/api/v1/me', href: '/docs/api/me' }] };
  expect(() => validateDocsLinks(operations, mappings, 'https://www.tryadeli.com')).toThrow('exactly one mapping');
  expect(() => validateMethodCoverage(['missingMethod'], new Set())).toThrow('missingMethod');
});

test('generation is standalone and ignores an invalid ADELI_CORE_DIR', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'adeli-api-reference-standalone-'));
  const path = join(directory, 'api-reference.md');
  try {
    await cp('src', join(directory, 'src'), { recursive: true });
    await cp('scripts', join(directory, 'scripts'), { recursive: true });
    await cp('openapi', join(directory, 'openapi'), { recursive: true });
    await writeFile(join(directory, 'package.json'), '{"type":"module"}');
    await symlink(join(process.cwd(), 'node_modules'), join(directory, 'node_modules'), 'junction');
    execFileSync(join(process.cwd(), 'node_modules/.bin/tsx'), [join(directory, 'scripts/generate-api-reference.ts'), '--output', path], {
      cwd: directory,
      env: { ...process.env, ADELI_CORE_DIR: '/deliberately-invalid/adeli-core' },
      stdio: 'pipe',
    });
    expect((await readFile(path, 'utf8')).length).toBeGreaterThan(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// Two real generator subprocesses can exceed the unit-test budget on CI runners.
test('API-reference reproducibility checks do not mutate the checked document, including stale failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'adeli-api-reference-test-'));
  const path = join(directory, 'api-reference.md');
  const document = await readFile('docs/api-reference.md', 'utf8');
  const runCheck = (): void => {
    execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--no-install', 'tsx', 'scripts/check-api-reference.ts', '--path', path], { stdio: 'pipe' });
  };
  try {
    await writeFile(path, document);
    const passingBefore = await stat(path);
    runCheck();
    expect(await readFile(path, 'utf8')).toBe(document);
    expect((await stat(path)).mtimeMs).toBe(passingBefore.mtimeMs);

    await writeFile(path, `${document}\nSTALE`);
    const staleBefore = await stat(path);
    expect(() => runCheck()).toThrow();
    expect(await readFile(path, 'utf8')).toBe(`${document}\nSTALE`);
    expect((await stat(path)).mtimeMs).toBe(staleBefore.mtimeMs);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);
