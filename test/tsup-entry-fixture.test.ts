import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { it } from 'vitest';

it('keeps shared runtime errors identical across split:false ESM/CJS entries', () => {
  const root = mkdtempSync(join(tmpdir(), 'adeli-tsup-entry-'));
  try {
    mkdirSync(join(root, 'src/helpers'), { recursive: true });
    mkdirSync(join(root, 'node_modules'));
    symlinkSync(join(process.cwd(), 'node_modules/typescript'), join(root, 'node_modules/typescript'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: '@adeli/sdk', type: 'module',
      exports: {
        '.': { import: './dist/index.js', require: './dist/index.cjs' },
        './helpers': { import: './dist/helpers/index.js', require: './dist/helpers/index.cjs' },
      },
    }));
    writeFileSync(join(root, 'src/index.ts'), 'export class TimeoutError extends Error {}\n');
    writeFileSync(join(root, 'src/helpers/index.ts'), "import { TimeoutError } from '@adeli/sdk';\nexport function timeout() { return new TimeoutError('fixture'); }\n");
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, baseUrl: '.', paths: { '@adeli/sdk': ['src/index.ts'] } }, include: ['src'] }));
    writeFileSync(join(root, 'tsup.config.ts'), `import { defineConfig } from ${JSON.stringify(join(process.cwd(), 'node_modules/tsup/dist/index.js'))};\nexport default defineConfig({ entry: { index: 'src/index.ts', 'helpers/index': 'src/helpers/index.ts' }, format: ['esm', 'cjs'], dts: true, splitting: false, external: ['@adeli/sdk'], outDir: 'dist', clean: true });\n`);
    execFileSync(join(process.cwd(), 'node_modules/.bin/tsup'), ['--config', 'tsup.config.ts'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'check.mjs'), "import * as root from './dist/index.js'; import * as helper from './dist/helpers/index.js'; if (!(helper.timeout() instanceof root.TimeoutError)) throw new Error('ESM class identity failed');\n");
    writeFileSync(join(root, 'check.cjs'), "const root = require('./dist/index.cjs'); const helper = require('./dist/helpers/index.cjs'); if (!(helper.timeout() instanceof root.TimeoutError)) throw new Error('CJS class identity failed');\n");
    execFileSync(process.execPath, ['check.mjs'], { cwd: root, stdio: 'pipe' });
    execFileSync(process.execPath, ['check.cjs'], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
