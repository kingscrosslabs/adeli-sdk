import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const temp = await mkdtemp(join(tmpdir(), 'adeli-generated-'));
const output = join(temp, 'api.ts');
try {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--no-install', 'openapi-typescript', 'openapi/adeli.openapi.json', '-o', output], { stdio: 'inherit' });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`generator exited with ${code}`)));
  });
  const [checkedIn, regenerated] = await Promise.all([readFile('src/generated/api.ts', 'utf8'), readFile(output, 'utf8')]);
  if (checkedIn !== regenerated) throw new Error('Generated output is stale; run npm run generate');
  console.log('Generated output is reproducible and current');
} finally { await rm(temp, { recursive: true, force: true }); }
