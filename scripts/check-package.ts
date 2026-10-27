import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

interface PackageJson {
  name?: string;
  version?: string;
  license?: string;
  engines?: { node?: string };
  dependencies?: Record<string, string>;
  exports?: Record<string, unknown>;
}
interface PackFile { path?: string; }
interface PackRecord { files?: PackFile[]; }

const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as PackageJson;
const release = process.argv.includes('--release');
const errors: string[] = [];

if (packageJson.engines?.node !== '>=22') errors.push('package engines.node must remain exactly >=22');
if (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) errors.push('runtime dependencies are not permitted');
if (typeof packageJson.license !== 'string' || packageJson.license.length === 0) errors.push('license metadata is required; use UNLICENSED until approval');
const approvedLicense = typeof packageJson.license === 'string' && packageJson.license !== 'UNLICENSED';
let hasLicenseFile = false;
try {
  await access('LICENSE');
  hasLicenseFile = true;
} catch {
  // A missing LICENSE file is reported below when license metadata requires one.
}
if (approvedLicense && !hasLicenseFile) errors.push('approved license metadata requires a LICENSE file');
if (release && packageJson.license === 'UNLICENSED') errors.push('release blocked: license approval is still pending');
for (const entry of ['.', './helpers', './uploads']) {
  if (!packageJson.exports || !(entry in packageJson.exports)) errors.push(`missing conditional export ${entry}`);
}

let packedFiles: string[] = [];
try {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const records = JSON.parse(output) as PackRecord[];
  packedFiles = records.flatMap(record => (record.files ?? []).flatMap(file => file.path ? [file.path.replace(/^package\//, '')] : []));
} catch (error) {
  errors.push(`npm pack --dry-run failed: ${error instanceof Error ? error.message : String(error)}`);
}

const forbidden = /(^|\/)(?:test|tests|plans|\.git|\.github|\.env(?:\.|$)|.*\.pem$|.*\.key$|tsconfig(?:\.|$)|vitest\.config|tsup\.config|eslint\.config|package-lock\.json)/i;
for (const file of packedFiles) if (forbidden.test(file)) errors.push(`forbidden private/test/config file would be packed: ${file}`);
for (const required of ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/index.d.cts', 'openapi/adeli.openapi.json', 'openapi/provenance.json']) {
  if (!packedFiles.includes(required)) errors.push(`tarball is missing required file ${required}`);
}
for (const required of ['README.md', 'docs/client.md', 'docs/publishing.md', 'docs/api-reference.md', 'docs/maintenance.md']) {
  if (!packedFiles.includes(required)) errors.push(`tarball is missing public documentation ${required}`);
}
if (approvedLicense && !packedFiles.includes('LICENSE')) errors.push('tarball is missing the approved LICENSE file');
for (const required of ['dist/helpers/index.js', 'dist/helpers/index.cjs', 'dist/helpers/index.d.ts', 'dist/helpers/index.d.cts', 'dist/uploads.js', 'dist/uploads.cjs', 'dist/uploads.d.ts', 'dist/uploads.d.cts']) {
  if (!packedFiles.includes(required)) errors.push(`declared public entry is not built: ${required}`);
}

if (errors.length) {
  console.error('Package gate failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Package gate passed for ${packageJson.name ?? 'package'}@${packageJson.version ?? 'unknown'} (${packedFiles.length} files)`);
}
