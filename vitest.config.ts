import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@adeli/node/helpers': new URL('./src/helpers/index.ts', import.meta.url).pathname, '@adeli/node/uploads': new URL('./src/uploads.ts', import.meta.url).pathname, '@adeli/node': new URL('./src/index.ts', import.meta.url).pathname } },
  test: { environment: 'node', globals: true, clearMocks: true, restoreMocks: true, setupFiles: ['./test/setup.ts'], exclude: [...configDefaults.exclude, '**/dist/**', '**/.worktrees/**'] },
});
