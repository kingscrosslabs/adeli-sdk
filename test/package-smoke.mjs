import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { packToolchain } from '../scripts/packed-toolchain.mjs';

const workspace = process.env.ADELI_PACKAGE_SMOKE_ROOT ?? process.cwd();
const toolingRoot = process.env.ADELI_PACKAGE_SMOKE_TOOL_ROOT ?? process.cwd();
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const node = process.execPath;
const temporary = mkdtempSync(join(tmpdir(), 'adeli-sdk-package-'));

function fail(message) { throw new Error(message); }

try {
  const packRecord = JSON.parse(execFileSync(npm, ['pack', '--json', '--pack-destination', temporary], { cwd: workspace, encoding: 'utf8' }))[0];
  const tarball = join(temporary, packRecord.filename);
  const extracted = join(temporary, 'extracted');
  execFileSync('mkdir', ['-p', extracted]);
  execFileSync('tar', ['-xzf', tarball, '-C', extracted]);
  const packageDir = join(extracted, 'package');

  const requiredEntries = [
    'dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/index.d.cts',
    'dist/helpers/index.js', 'dist/helpers/index.cjs', 'dist/helpers/index.d.ts', 'dist/helpers/index.d.cts',
    'dist/uploads.js', 'dist/uploads.cjs', 'dist/uploads.d.ts', 'dist/uploads.d.cts',
  ];
  const missing = requiredEntries.filter(path => {
    try { readFileSync(join(packageDir, path)); return false; } catch { return true; }
  });
  if (missing.length) {
    console.error('Packed consumer gate blocked: declared entrypoints are not present in this foundation.');
    for (const path of missing) console.error(`- ${path}`);
    fail('declared package entrypoints are missing');
  }

  const bin = name => join(toolingRoot, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
  execFileSync(bin('publint'), ['run', packageDir, '--strict'], { cwd: toolingRoot, stdio: 'inherit' });
  // attw accepts an existing .tgz directly; --pack is for a package directory.
  execFileSync(bin('attw'), ['--profile', 'node16', tarball], { cwd: toolingRoot, stdio: 'inherit' });

  const consumer = join(temporary, 'consumer');
  mkdirSync(consumer);
  execFileSync(npm, ['init', '--yes'], { cwd: consumer, stdio: 'ignore' });
  execFileSync(npm, [
    'install', '--offline', '--no-audit', '--no-fund', '--ignore-scripts', '--no-package-lock',
    tarball, ...packToolchain(toolingRoot, join(temporary, 'toolchain')),
  ], { cwd: consumer, stdio: 'inherit' });
  const packageJsonPath = join(consumer, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  packageJson.type = 'module';
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  writeFileSync(join(consumer, 'esm.mjs'), `
import * as sdk from '@adeli/sdk';
import * as helpers from '@adeli/sdk/helpers';
import '@adeli/sdk/uploads';
const signed = helpers.verifyWebhookSignature({ payload: '', header: 't=1793136000,v1=fb6126475a8948b0be6f64fb2ab49f6e733dd2392cd6caa1524cb64a8c4c7262', secret: 'whsec_test_secret', now: 1793136000 });
if (!signed) throw new Error('packed webhook signature helper rejected the fixed vector');
const details = { reconnect: { action: 'restart_oauth' } };
if (!sdk.isPermissionRequiredDetails(details)) throw new Error('permission detail guard export is missing');
const client = { getConnection: async () => ({ data: { status: 'pending_authorization' }, status: 200, headers: new Headers() }) };
try {
  await helpers.waitForConnection(client, { path: { profileId: 'profile', connectionSessionId: 'session' } }, { timeoutMs: 1, intervalMs: 1 });
  throw new Error('waitForConnection unexpectedly completed');
} catch (error) {
  if (!(error instanceof sdk.TimeoutError)) throw error;
}
`);
  execFileSync(node, [join(consumer, 'esm.mjs')], { cwd: consumer, stdio: 'inherit' });

  writeFileSync(join(consumer, 'cjs.cjs'), `
const sdk = require('@adeli/sdk');
const helpers = require('@adeli/sdk/helpers');
require('@adeli/sdk/uploads');
const signed = helpers.verifyWebhookSignature({ payload: '', header: 't=1793136000,v1=fb6126475a8948b0be6f64fb2ab49f6e733dd2392cd6caa1524cb64a8c4c7262', secret: 'whsec_test_secret', now: 1793136000 });
if (!signed) throw new Error('packed webhook signature helper rejected the fixed vector');
const details = { reconnect: { action: 'restart_oauth' } };
if (!sdk.isPermissionRequiredDetails(details)) throw new Error('permission detail guard export is missing');
const client = { getConnection: async () => ({ data: { status: 'pending_authorization' }, status: 200, headers: new Headers() }) };
helpers.waitForConnection(client, { path: { profileId: 'profile', connectionSessionId: 'session' } }, { timeoutMs: 1, intervalMs: 1 }).then(
  () => { throw new Error('waitForConnection unexpectedly completed'); },
  error => { if (!(error instanceof sdk.TimeoutError)) throw error; },
);
`);
  execFileSync(node, [join(consumer, 'cjs.cjs')], { cwd: consumer, stdio: 'inherit' });

  writeFileSync(join(consumer, 'consumer.mts'), `import { Adeli, isPermissionRequiredDetails, type PermissionRequiredDetails } from '@adeli/sdk';\nimport { waitForConnection } from '@adeli/sdk/helpers';\nconst details: PermissionRequiredDetails = { reconnect: { action: 'restart_oauth' } };\nnew Adeli({ apiKey: 'test' });\nvoid isPermissionRequiredDetails(details);\nvoid waitForConnection;\n`);
  writeFileSync(join(consumer, 'consumer.cts'), `import { Adeli, isPermissionRequiredDetails, type PermissionRequiredDetails } from '@adeli/sdk';\nimport { waitForConnection } from '@adeli/sdk/helpers';\nconst details: PermissionRequiredDetails = { reconnect: { action: 'restart_oauth' } };\nnew Adeli({ apiKey: 'test' });\nvoid isPermissionRequiredDetails(details);\nvoid waitForConnection;\n`);
  writeFileSync(join(consumer, 'consumer-bundler.ts'), `import { Adeli, isPermissionRequiredDetails, type PermissionRequiredDetails } from '@adeli/sdk';\nimport { waitForConnection } from '@adeli/sdk/helpers';\nimport '@adeli/sdk/uploads';\nconst details: PermissionRequiredDetails = { reconnect: { action: 'restart_oauth' } };\nnew Adeli({ apiKey: 'test' });\nvoid isPermissionRequiredDetails(details);\nvoid waitForConnection;\n`);
  writeFileSync(join(consumer, 'tsconfig.nodenext.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, types: ['node'] }, include: ['consumer.mts', 'consumer.cts'] }));
  writeFileSync(join(consumer, 'tsconfig.bundler.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true, types: ['node'] }, include: ['consumer-bundler.ts'] }));
  const tsc = join(consumer, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
  execFileSync(tsc, ['--project', 'tsconfig.nodenext.json'], { cwd: consumer, stdio: 'inherit' });
  execFileSync(tsc, ['--project', 'tsconfig.bundler.json'], { cwd: consumer, stdio: 'inherit' });
  console.log(`Packed ESM/CJS and NodeNext/bundler consumers passed: ${packRecord.filename}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
