import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export function parseOpenApi(text, label = 'document') {
  let document;
  try { document = JSON.parse(text); } catch (error) { throw new Error(`${label} is not valid JSON: ${error.message}`); }
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error(`${label} must be a JSON object`);
  if (typeof document.openapi !== 'string' || !/^3\.1\./.test(document.openapi)) throw new Error(`${label} is not an OpenAPI 3.1 document`);
  if (!document.paths || typeof document.paths !== 'object' || Array.isArray(document.paths) || Object.keys(document.paths).length === 0) throw new Error(`${label} has no non-empty paths object`);
  return document;
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  return value;
}

export function compareOpenApiDocuments(baselineText, candidateText) {
  const baseline = parseOpenApi(baselineText, 'baseline');
  const candidate = parseOpenApi(candidateText, 'candidate');
  const baselineRawSha256 = createHash('sha256').update(baselineText).digest('hex');
  const candidateRawSha256 = createHash('sha256').update(candidateText).digest('hex');
  const baselineCanonical = JSON.stringify(canonicalJson(baseline));
  const candidateCanonical = JSON.stringify(canonicalJson(candidate));
  const baselineCanonicalSha256 = createHash('sha256').update(baselineCanonical).digest('hex');
  const candidateCanonicalSha256 = createHash('sha256').update(candidateCanonical).digest('hex');
  const changedSections = [...new Set([...Object.keys(baseline), ...Object.keys(candidate)])].filter(key => JSON.stringify(canonicalJson(baseline[key])) !== JSON.stringify(canonicalJson(candidate[key])));
  const status = baselineCanonical === candidateCanonical ? (baselineText === candidateText ? 'equal' : 'formatting-only') : 'changed';
  return { status, baselineRawSha256, candidateRawSha256, baselineCanonicalSha256, candidateCanonicalSha256, changedSections, baselinePathCount: Object.keys(baseline.paths).length, candidatePathCount: Object.keys(candidate.paths).length };
}

function valueAfter(args, flag) { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; }
function report(result) {
  const lines = [
    '# OpenAPI drift report', '',
    `- Status: **${result.status}**`,
    `- Baseline raw SHA-256: \`${result.baselineRawSha256}\``,
    `- Candidate raw SHA-256: \`${result.candidateRawSha256}\``,
    `- Baseline canonical SHA-256: \`${result.baselineCanonicalSha256}\``,
    `- Candidate canonical SHA-256: \`${result.candidateCanonicalSha256}\``,
    `- Paths: ${result.baselinePathCount} baseline / ${result.candidatePathCount} candidate`,
  ];
  if (result.status === 'formatting-only') lines.push('', 'Raw bytes differ, but parsed canonical JSON is equal. This is formatting/key-order drift only; no semantic review is required.');
  if (result.status === 'changed') lines.push('', `Changed top-level sections requiring review: ${result.changedSections.join(', ') || '(undetermined)'}. This workflow does not update, publish, or auto-merge anything.`);
  if (result.status === 'equal') lines.push('', 'No raw or canonical drift detected.');
  return `${lines.join('\n')}\n`;
}

const args = process.argv.slice(2);
if (args.includes('--baseline') && args.includes('--candidate')) {
  const baselinePath = valueAfter(args, '--baseline');
  const candidatePath = valueAfter(args, '--candidate');
  const reportPath = valueAfter(args, '--report');
  try {
    const result = compareOpenApiDocuments(readFileSync(baselinePath, 'utf8'), readFileSync(candidatePath, 'utf8'));
    if (reportPath) writeFileSync(reportPath, report(result));
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'changed') process.exitCode = 1;
  } catch (error) {
    const message = `# OpenAPI drift report\n\n- Status: **invalid**\n- Error: ${error.message}\n`;
    if (reportPath) writeFileSync(reportPath, message);
    console.error(message);
    process.exitCode = 2;
  }
}
