import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { packToolchain } from './packed-toolchain.mjs';

const workspace = resolve(process.env.ADELI_EXAMPLES_ROOT ?? process.cwd());
const examples = join(workspace, 'examples');
let entries: string[];
try {
  entries = await readdir(examples, { recursive: true });
} catch {
  console.error('Example gate blocked: examples/**/*.ts is not present in this foundation; no success is being claimed.');
  process.exit(1);
}
if (!entries.some(entry => entry.endsWith('.ts'))) {
  console.error('Example gate blocked: examples/**/*.ts is not present in this foundation; no success is being claimed.');
  process.exit(1);
}

const temporary = await mkdtemp(join(tmpdir(), 'adeli-sdk-examples-'));
try {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const packRecord = JSON.parse(execFileSync(npm, ['pack', '--json', '--pack-destination', temporary], { cwd: workspace, encoding: 'utf8' }))[0] as { filename: string };
  const tarball = join(temporary, packRecord.filename);
  const consumer = join(temporary, 'consumer');
  await mkdir(consumer);
  execFileSync(npm, ['init', '--yes'], { cwd: consumer, stdio: 'ignore' });
  execFileSync(npm, [
    'install', '--offline', '--no-audit', '--no-fund', '--ignore-scripts', '--no-package-lock',
    tarball, ...packToolchain(process.cwd(), join(temporary, 'toolchain')),
  ], { cwd: consumer, stdio: 'inherit' });
  const packageJsonPath = join(consumer, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as Record<string, unknown>;
  packageJson.type = 'module';
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  await cp(examples, join(consumer, 'examples'), { recursive: true });
  const config = {
    compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
      strict: true, noEmit: true, types: ['node'],
    },
    include: ['examples/**/*.ts'],
  };
  const configPath = join(consumer, 'tsconfig.examples-packed.json');
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const tsc = join(consumer, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
  execFileSync(tsc, ['--project', configPath], { cwd: consumer, stdio: 'inherit' });
  console.log(`Examples typecheck passed against packed candidate ${packRecord.filename}.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
