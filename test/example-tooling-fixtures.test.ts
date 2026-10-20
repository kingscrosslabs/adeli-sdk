import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

function writeExampleFixture(root: string, valid: boolean): void {
  mkdirSync(join(root, 'dist'), { recursive: true });
  mkdirSync(join(root, 'examples'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: '@adeli/sdk', version: '0.0.0-example-fixture', type: 'module', engines: { node: '>=22' },
    files: ['dist'], exports: { '.': { import: { types: './dist/index.d.ts', default: './dist/index.js' }, require: { types: './dist/index.d.cts', default: './dist/index.cjs' } } },
  }, null, 2));
  writeFileSync(join(root, 'dist/index.js'), 'export class Adeli {}\n');
  writeFileSync(join(root, 'dist/index.cjs'), 'class Adeli {}\nmodule.exports = { Adeli };\n');
  writeFileSync(join(root, 'dist/index.d.ts'), 'export declare class Adeli {}\n');
  writeFileSync(join(root, 'dist/index.d.cts'), 'export declare class Adeli {}\n');
  writeFileSync(join(root, 'examples/read.ts'), valid
    ? "import { Adeli } from '@adeli/sdk';\nnew Adeli();\n"
    : "import { MissingExport } from '@adeli/sdk';\nnew MissingExport();\n");
}

describe('packed example typecheck tooling', () => {
  it('compiles a valid example against the installed tarball with an empty offline cache', () => {
    const root = mkdtempSync(join(tmpdir(), 'adeli-example-fixture-'));
    try {
      writeExampleFixture(root, true);
      execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/typecheck-examples.ts'], {
        env: { ...process.env, ADELI_EXAMPLES_ROOT: root, NPM_CONFIG_CACHE: join(root, '.npm-cache'), npm_config_cache: join(root, '.npm-cache'), NPM_CONFIG_OFFLINE: 'true' }, stdio: 'pipe',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  // Packing/installing and invoking tsc needs the same budget as the positive case.
  it('rejects an example that is invalid against the packed declarations', () => {
    const root = mkdtempSync(join(tmpdir(), 'adeli-example-negative-'));
    try {
      writeExampleFixture(root, false);
      expect(() => execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/typecheck-examples.ts'], {
        env: { ...process.env, ADELI_EXAMPLES_ROOT: root }, stdio: 'pipe',
      })).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
