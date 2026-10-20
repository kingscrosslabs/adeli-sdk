import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('release tooling policy', () => {
  it('declares the three public package surfaces without runtime dependencies', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      dependencies?: Record<string, string>;
      license?: string;
      exports?: Record<string, unknown>;
      files?: string[];
    };
    expect(packageJson.dependencies ?? {}).toEqual({});
    expect(packageJson.license).toBe('UNLICENSED');
    expect(Object.keys(packageJson.exports ?? {})).toEqual(['.', './helpers', './uploads']);
    expect(packageJson.files).not.toContain('test');
    expect(packageJson.files).not.toContain('plans');
  });

  it('keeps package validation on packed files and both type tooling checks', async () => {
    const smoke = await readFile('test/package-smoke.mjs', 'utf8');
    expect(smoke).toContain("['pack'");
    expect(smoke).toContain("'publint'");
    expect(smoke).toContain("'attw'");
    expect(smoke).toContain("moduleResolution: 'NodeNext'");
    expect(smoke).toContain("moduleResolution: 'Bundler'");
  });
});
