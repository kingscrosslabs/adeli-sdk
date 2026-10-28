import { existsSync } from 'node:fs';
import { defineConfig } from 'tsup';

// The release surface is deliberately declared in package.json before the
// corresponding helper/upload sources land. The package gate fails closed until
// every declared entry exists; this keeps a provisional build useful without
// silently manufacturing an entry point.
const entries: Record<string, string> = { index: 'src/index.ts' };
if (existsSync('src/helpers/index.ts')) entries['helpers/index'] = 'src/helpers/index.ts';
if (existsSync('src/uploads.ts')) entries.uploads = 'src/uploads.ts';

export default defineConfig({
  entry: entries,
  format: ['esm', 'cjs'], dts: true, splitting: false, clean: true, sourcemap: true,
  // Helpers/uploads import runtime errors from the package self-reference. Keeping
  // that import external prevents splitting:false from creating duplicate classes.
  external: ['@adeli/sdk'],
  outDir: 'dist', target: 'node24', treeshake: true
});
