import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

function writeFixture(root: string, includeUploads: boolean): void {
  mkdirSync(join(root, 'dist', 'helpers'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: '@adeli/sdk', version: '0.0.0-fixture', type: 'module', license: 'UNLICENSED',
    files: ['dist'],
    exports: {
      '.': { import: { types: './dist/index.d.ts', default: './dist/index.js' }, require: { types: './dist/index.d.cts', default: './dist/index.cjs' } },
      './helpers': { import: { types: './dist/helpers/index.d.ts', default: './dist/helpers/index.js' }, require: { types: './dist/helpers/index.d.cts', default: './dist/helpers/index.cjs' } },
      './uploads': { import: { types: './dist/uploads.d.ts', default: './dist/uploads.js' }, require: { types: './dist/uploads.d.cts', default: './dist/uploads.cjs' } },
    },
  }, null, 2));
  writeFileSync(join(root, 'dist/index.js'), "export class TimeoutError extends Error {}\nexport class Adeli { constructor(_options) {} }\nexport function isPermissionRequiredDetails(value) { return value?.reconnect?.action === 'restart_oauth'; }\n");
  writeFileSync(join(root, 'dist/index.cjs'), "class TimeoutError extends Error {}\nclass Adeli { constructor(_options) {} }\nfunction isPermissionRequiredDetails(value) { return value?.reconnect?.action === 'restart_oauth'; }\nmodule.exports = { TimeoutError, Adeli, isPermissionRequiredDetails };\n");
  writeFileSync(join(root, 'dist/index.d.ts'), "export declare class TimeoutError extends Error {}\nexport declare class Adeli { constructor(options?: { apiKey?: string }); }\nexport type PermissionRequiredDetails = { reconnect?: { action: 'restart_oauth' } } & Record<string, unknown>;\nexport declare function isPermissionRequiredDetails(value: unknown): value is PermissionRequiredDetails;\n");
  writeFileSync(join(root, 'dist/index.d.cts'), "export declare class TimeoutError extends Error {}\nexport declare class Adeli { constructor(options?: { apiKey?: string }); }\nexport type PermissionRequiredDetails = { reconnect?: { action: 'restart_oauth' } } & Record<string, unknown>;\nexport declare function isPermissionRequiredDetails(value: unknown): value is PermissionRequiredDetails;\n");
  writeFileSync(join(root, 'dist/helpers/index.js'), "import { TimeoutError } from '@adeli/sdk';\nexport async function waitForConnection(_client, _args, _options) { throw new TimeoutError('timed out'); }\nexport function verifyWebhookSignature(_input) { return true; }\n");
  writeFileSync(join(root, 'dist/helpers/index.cjs'), "const { TimeoutError } = require('@adeli/sdk');\nasync function waitForConnection(_client, _args, _options) { throw new TimeoutError('timed out'); }\nfunction verifyWebhookSignature(_input) { return true; }\nmodule.exports = { waitForConnection, verifyWebhookSignature };\n");
  writeFileSync(join(root, 'dist/helpers/index.d.ts'), "export declare function waitForConnection(client: unknown, args: unknown, options?: { timeoutMs?: number; intervalMs?: number }): Promise<unknown>;\n");
  writeFileSync(join(root, 'dist/helpers/index.d.cts'), "export declare function waitForConnection(client: unknown, args: unknown, options?: { timeoutMs?: number; intervalMs?: number }): Promise<unknown>;\n");
  if (includeUploads) {
    writeFileSync(join(root, 'dist/uploads.js'), 'export {};\n');
    writeFileSync(join(root, 'dist/uploads.cjs'), 'module.exports = {};\n');
    writeFileSync(join(root, 'dist/uploads.d.ts'), 'export {};\n');
    writeFileSync(join(root, 'dist/uploads.d.cts'), 'export {};\n');
  }
}

describe('release tooling fixtures', () => {
  it('runs the packed consumer gate with a complete package and empty offline cache', () => {
    const root = mkdtempSync(join(tmpdir(), 'adeli-package-fixture-'));
    try {
      writeFixture(root, true);
      execFileSync(process.execPath, ['test/package-smoke.mjs'], {
        env: { ...process.env, ADELI_PACKAGE_SMOKE_ROOT: root, ADELI_PACKAGE_SMOKE_TOOL_ROOT: process.cwd(), NPM_CONFIG_CACHE: join(root, '.npm-cache'), npm_config_cache: join(root, '.npm-cache'), NPM_CONFIG_OFFLINE: 'true' },
        stdio: 'inherit',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  it('fails the real packed consumer gate when a declared entry is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'adeli-package-negative-'));
    try {
      writeFixture(root, false);
      expect(() => execFileSync(process.execPath, ['test/package-smoke.mjs'], {
        env: { ...process.env, ADELI_PACKAGE_SMOKE_ROOT: root, ADELI_PACKAGE_SMOKE_TOOL_ROOT: process.cwd() },
        stdio: 'pipe',
      })).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
