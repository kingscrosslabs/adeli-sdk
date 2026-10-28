import { describe, expect, it } from 'vitest';
import { validateReleaseIdentity } from '../scripts/check-release-provenance.mjs';

const start = 'a'.repeat(40);
const release = 'b'.repeat(40);
const valid = {
  eventRef: 'refs/heads/main',
  eventSha: start,
  headSha: release,
  tagSha: release,
  parentSha: start,
  releaseTag: 'v0.1.1',
  changedFiles: ['.changeset/bright-ears-look.md', 'CHANGELOG.md', 'package-lock.json', 'package.json'],
  packageName: '@adeli/sdk',
  packageVersion: '0.1.1',
};

describe('release provenance identity validation', () => {
  it('accepts the tagged version bump directly on top of the run commit', () => {
    expect(() => validateReleaseIdentity(valid)).not.toThrow();
  });

  it.each([
    ['a run not started from main', { eventRef: 'refs/heads/feature' }],
    ['a run started from a tag', { eventRef: 'refs/tags/v0.1.1' }],
    ['a checkout that is not the tagged commit', { headSha: 'c'.repeat(40) }],
    ['a release commit not directly on the run commit', { parentSha: 'c'.repeat(40) }],
    ['a tag that does not match the package version', { releaseTag: 'v0.1.2' }],
    ['another package', { packageName: '@adeli/other' }],
    ['a release commit that does not bump package.json', { changedFiles: ['CHANGELOG.md'] }],
    ['a release commit that changes source', { changedFiles: [...valid.changedFiles, 'src/index.ts'] }],
  ])('rejects %s before publication', (_name, override) => {
    expect(() => validateReleaseIdentity({ ...valid, ...override })).toThrow(/Release provenance validation failed/);
  });

  it('rejects a publish identity that differs from the validated release', () => {
    expect(() => validateReleaseIdentity({ ...valid, identity: { ...valid, eventSha: 'c'.repeat(40) } })).toThrow(/validated release identity/);
  });
});
