import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const outputArg = process.argv.indexOf('--output');
const output = resolve(outputArg >= 0 && process.argv[outputArg + 1] ? process.argv[outputArg + 1]! : 'src/generated/api.ts');
const input = resolve('openapi/adeli.openapi.json');
await new Promise<void>((resolvePromise, reject) => {
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--no-install', 'openapi-typescript', input, '-o', output], { stdio: 'inherit' });
  child.on('error', reject); child.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(`openapi-typescript exited with ${code}`)));
});
await readFile(output);
console.log(`Generated ${output}`);
