import { describe, expect, it } from 'vitest';
import { validateReleaseIdentity } from '../scripts/check-release-provenance.mjs';

const valid = {
  eventRefType: 'tag',
  eventRef: 'refs/tags/v0.1.0',
  eventRefName: 'v0.1.0',
  eventSha: 'a'.repeat(40),
  headSha: 'a'.repeat(40),
  releaseTag: 'v0.1.0',
  reviewedVersion: '0.1.0',
  packageName: '@adeli/sdk',
  packageVersion: '0.1.0',
};

describe('release provenance identity validation', () => {
  it('accepts a tag-dispatched event whose checkout and package match', () => {
    expect(() => validateReleaseIdentity(valid)).not.toThrow();
  });

  it.each([
    ['branch dispatch', { eventRefType: 'branch' }],
    ['wrong event ref', { eventRef: 'refs/heads/main' }],
    ['detached/mismatched checkout', { headSha: 'b'.repeat(40) }],
    ['wrong reviewed tag', { releaseTag: 'v0.1.1' }],
    ['wrong package version', { packageVersion: '0.1.1' }],
  ])('rejects %s before publication', (_name, override) => {
    expect(() => validateReleaseIdentity({ ...valid, ...override })).toThrow(/Release provenance validation failed/);
  });

  it('rejects a publish identity that differs from the validated event', () => {
    expect(() => validateReleaseIdentity({ ...valid, identity: { ...valid, eventSha: 'b'.repeat(40) } })).toThrow(/validated event identity/);
  });
});
