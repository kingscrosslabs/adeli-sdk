import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
export default [{ ignores: ['dist/**', 'src/generated/**', 'examples/**', 'node_modules/**', '**/.worktrees/**'] }, { files: ['**/*.ts'], languageOptions: { parser, parserOptions: { project: './tsconfig.json', sourceType: 'module' } }, plugins: { '@typescript-eslint': tseslint }, rules: { 'no-unused-vars': 'off', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } }];
