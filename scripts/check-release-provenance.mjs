import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateReleaseIdentity(input) {
  const errors = [];
  if (input.eventRefType !== 'tag') {
    throw new Error(`Release provenance validation failed:\n- release must run on a tag ref (received ${input.eventRefType || 'missing'}); pick the release tag under "Use workflow from" → Tags`);
  }
  if (input.eventRef !== `refs/tags/${input.releaseTag}`) errors.push(`event ref ${input.eventRef} does not match refs/tags/${input.releaseTag}`);
  if (input.eventRefName !== input.releaseTag) errors.push(`event ref name ${input.eventRefName} does not match release tag ${input.releaseTag}`);
  if (input.eventSha !== input.headSha) errors.push(`checked-out HEAD ${input.headSha} does not match workflow event SHA ${input.eventSha}`);
  if (`v${input.reviewedVersion}` !== input.releaseTag) errors.push(`reviewed version ${input.reviewedVersion} does not match release tag ${input.releaseTag}`);
  if (input.packageName !== '@adeli/sdk') errors.push(`package name ${input.packageName} is not @adeli/sdk`);
  if (input.packageVersion !== input.reviewedVersion) errors.push(`package version ${input.packageVersion} does not match reviewed version ${input.reviewedVersion}`);
  if (input.identity) {
    for (const field of ['eventRefType', 'eventRef', 'eventRefName', 'eventSha', 'releaseTag', 'reviewedVersion', 'packageName']) {
      if (input.identity[field] !== input[field]) errors.push(`publish event ${field} differs from validated event identity`);
    }
    if (input.identity.headSha !== input.headSha) errors.push('publish checkout HEAD differs from validated checkout HEAD');
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
  const input = {
    eventRefType: process.env.EVENT_REF_TYPE,
    eventRef: process.env.EVENT_REF,
    eventRefName: process.env.EVENT_REF_NAME,
    eventSha: process.env.EVENT_SHA,
    headSha: process.env.HEAD_SHA,
    // The release tag is the pushed tag; its version is the tag without the leading "v".
    releaseTag: process.env.EVENT_REF_NAME,
    reviewedVersion: process.env.EVENT_REF_NAME?.replace(/^v/, ''),
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    identity,
  };
  validateReleaseIdentity(input);
  if (artifact) {
    const artifactPath = resolve(artifact);
    const metadata = packageMetadataFromTarball(artifactPath);
    if (metadata.name !== input.packageName || metadata.version !== input.reviewedVersion) {
      throw new Error(`Packed artifact metadata ${metadata.name}@${metadata.version} does not match ${input.packageName}@${input.reviewedVersion}`);
    }
    const artifactSha256 = sha256(artifactPath);
    if (identity?.artifactSha256 && identity.artifactSha256 !== artifactSha256) throw new Error('Packed artifact hash differs from validated artifact hash');
    if (args.includes('--write-identity')) {
      const output = identityFile ?? valueAfter(args, '--write-identity');
      if (!output) throw new Error('--write-identity requires an output path');
      writeFileSync(output, `${JSON.stringify({ ...input, artifactSha256, artifactName: basename(artifactPath) }, null, 2)}\n`);
    }
    console.log(`Release identity and artifact validated: ${input.packageName}@${input.reviewedVersion} ${artifactSha256}`);
  } else {
    console.log(`Release identity validated: ${input.eventRef} at ${input.headSha}`);
  }
}
