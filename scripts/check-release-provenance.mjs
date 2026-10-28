import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Files the release commit may touch on top of the commit the run started from.
const RELEASE_FILES = new Set(['package.json', 'package-lock.json', 'CHANGELOG.md']);
const isReleaseFile = file => RELEASE_FILES.has(file) || /^\.changeset\/[^/]+\.md$/.test(file);

// A release run starts on main at eventSha. Its first job commits the version bump
// directly on top of eventSha and tags it releaseTag. Every later job checks out that
// tag and must prove it is exactly that commit before any package work.
export function validateReleaseIdentity(input) {
  const errors = [];
  if (input.eventRef !== 'refs/heads/main') errors.push(`release must run from main (received ${input.eventRef || 'missing'})`);
  if (input.headSha !== input.tagSha) errors.push(`checked-out HEAD ${input.headSha} is not the commit tagged ${input.releaseTag} (${input.tagSha})`);
  if (input.parentSha !== input.eventSha) errors.push(`release commit's parent ${input.parentSha} is not the run's starting commit ${input.eventSha}`);
  if (input.releaseTag !== `v${input.packageVersion}`) errors.push(`release tag ${input.releaseTag} does not match package version ${input.packageVersion}`);
  if (input.packageName !== '@adeli/sdk') errors.push(`package name ${input.packageName} is not @adeli/sdk`);
  const changed = input.changedFiles ?? [];
  if (!changed.includes('package.json')) errors.push('release commit does not change package.json');
  const unexpected = changed.filter(file => !isReleaseFile(file));
  if (unexpected.length) errors.push(`release commit changes files other than the version bump: ${unexpected.join(', ')}`);
  if (input.identity) {
    for (const field of ['eventRef', 'eventSha', 'headSha', 'releaseTag', 'packageName', 'packageVersion']) {
      if (input.identity[field] !== input[field]) errors.push(`publish ${field} differs from validated release identity`);
    }
  }
  if (errors.length) throw new Error(`Release provenance validation failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
  return { ok: true };
}

function sha256(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function packageMetadataFromTarball(path) {
  return JSON.parse(execFileSync('tar', ['-xOf', path, 'package/package.json'], { encoding: 'utf8' }));
}
function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const artifact = valueAfter(args, '--artifact');
  const identityFile = valueAfter(args, '--identity-file');
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const identity = identityFile ? JSON.parse(readFileSync(identityFile, 'utf8')) : undefined;
  const git = (...gitArgs) => execFileSync('git', gitArgs, { encoding: 'utf8' }).trim();
  const releaseTag = process.env.RELEASE_TAG;
  const eventSha = process.env.EVENT_SHA;
  const headSha = git('rev-parse', 'HEAD');
  const input = {
    eventRef: process.env.EVENT_REF,
    eventSha,
    headSha,
    tagSha: releaseTag ? git('rev-parse', `refs/tags/${releaseTag}^{commit}`) : undefined,
    parentSha: git('rev-parse', 'HEAD^'),
    releaseTag,
    changedFiles: eventSha ? git('diff', '--name-only', eventSha, headSha).split('\n').filter(Boolean) : undefined,
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    identity,
  };
  validateReleaseIdentity(input);
  if (artifact) {
    const artifactPath = resolve(artifact);
    const metadata = packageMetadataFromTarball(artifactPath);
    if (metadata.name !== input.packageName || metadata.version !== input.packageVersion) {
      throw new Error(`Packed artifact metadata ${metadata.name}@${metadata.version} does not match ${input.packageName}@${input.packageVersion}`);
    }
    const artifactSha256 = sha256(artifactPath);
    if (identity?.artifactSha256 && identity.artifactSha256 !== artifactSha256) throw new Error('Packed artifact hash differs from validated artifact hash');
    if (args.includes('--write-identity')) {
      const output = identityFile ?? valueAfter(args, '--write-identity');
      if (!output) throw new Error('--write-identity requires an output path');
      writeFileSync(output, `${JSON.stringify({ ...input, artifactSha256, artifactName: basename(artifactPath) }, null, 2)}\n`);
    }
    console.log(`Release identity and artifact validated: ${input.packageName}@${input.packageVersion} ${artifactSha256}`);
  } else {
    console.log(`Release identity validated: ${input.releaseTag} at ${input.headSha} (bump on top of ${input.eventSha})`);
  }
}
