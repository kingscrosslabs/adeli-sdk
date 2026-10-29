import { afterEach, expect, it, vi } from 'vitest';
import { Adeli, ConfigurationError } from '../src/index.js';

afterEach(() => { vi.unstubAllGlobals(); });

// Workers without nodejs_compat have no `process` global.
it('constructs with an explicit apiKey when process is undefined', () => {
  vi.stubGlobal('process', undefined);
  expect(() => new Adeli({ apiKey: 'test-key' })).not.toThrow();
});

it('reports a missing key as ConfigurationError, not ReferenceError, when process is undefined', () => {
  vi.stubGlobal('process', undefined);
  expect(() => new Adeli()).toThrow(ConfigurationError);
});
