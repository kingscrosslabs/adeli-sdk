import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pathArgument = process.argv.slice(2).find((argument) => argument === '--path' || argument.startsWith('--path='));
const pathIndex = process.argv.indexOf('--path');
const path = pathArgument?.startsWith('--path=') ? pathArgument.slice('--path='.length) : pathIndex >= 0 ? process.argv[pathIndex + 1] : 'docs/api-reference.md';
if (!path) throw new Error('--path requires a file path');
const before = await readFile(path, 'utf8');
const tempDirectory = await mkdtemp(join(tmpdir(), 'adeli-api-reference-'));
const generatedPath = join(tempDirectory, 'api-reference.md');
try {
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--no-install', 'tsx', 'scripts/generate-api-reference.ts', '--output', generatedPath], { stdio: 'inherit' });
  const after = await readFile(generatedPath, 'utf8');
  if (before !== after) throw new Error('API reference is stale; run npm run generate:api-reference');
  console.log('API reference is reproducible and current');
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}
