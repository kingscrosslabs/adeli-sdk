import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Pack installed, lockfile-pinned development tools; never rely on an npm cache. */
export function packToolchain(toolingRoot, destination) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const packages = ['typescript', '@types/node', 'undici-types'];
  const devDependencies = JSON.parse(readFileSync(join(toolingRoot, 'package.json'), 'utf8')).devDependencies;
  mkdirSync(destination, { recursive: true });
  return packages.map(name => {
    const directory = join(toolingRoot, 'node_modules', name);
    const installed = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    if (name !== 'undici-types' && installed.version !== devDependencies[name]) {
      throw new Error(`Installed ${name} does not match the pinned development toolchain; run npm ci`);
    }
    const records = JSON.parse(execFileSync(npm, ['pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', destination, directory], { cwd: toolingRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    if (records.length !== 1 || typeof records[0].filename !== 'string') throw new Error(`Cannot pack installed ${name}`);
    return join(destination, records[0].filename);
  });
}
