import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);
type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function localReference(root: JsonObject, reference: string): unknown {
  if (!reference.startsWith('#/')) return undefined;
  let value: unknown = root;
  for (const rawPart of reference.slice(2).split('/')) {
    const part = rawPart.replace(/~1/g, '/').replace(/~0/g, '~');
    value = isObject(value) ? value[part] : undefined;
  }
  return value;
}

function checkReferences(root: JsonObject, value: unknown, seen = new Set<object>()) {
  if (!isObject(value) && !Array.isArray(value)) return;
  if (typeof value === 'object' && value !== null) {
    if (seen.has(value)) return;
    seen.add(value);
  }
  if (isObject(value) && typeof value.$ref === 'string' && value.$ref.startsWith('#/') && localReference(root, value.$ref) === undefined) {
    throw new Error(`Candidate OpenAPI document has an unresolved reference: ${value.$ref}`);
  }
  for (const child of Object.values(value)) checkReferences(root, child, seen);
}

export function validateOpenApiDocument(document: unknown): asserts document is JsonObject {
  if (!isObject(document) || typeof document.openapi !== 'string' || !/^3\.1\./.test(document.openapi)) {
    throw new Error('Candidate must be an OpenAPI 3.1 document');
  }
  if (!isObject(document.info) || typeof document.info.title !== 'string' || typeof document.info.version !== 'string') {
    throw new Error('Candidate OpenAPI document must include info.title and info.version');
  }
  if (!isObject(document.paths) || Object.keys(document.paths).length === 0) {
    throw new Error('Candidate OpenAPI document must include non-empty paths');
  }
  const operationIds = new Set<string>();
  let operationCount = 0;
  for (const [path, pathItem] of Object.entries(document.paths)) {
    if (!path.startsWith('/') || !isObject(pathItem)) throw new Error(`Invalid OpenAPI path item: ${path}`);
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      if (!isObject(operation) || typeof operation.operationId !== 'string' || operation.operationId.trim() === '') {
        throw new Error(`${method.toUpperCase()} ${path} must have a non-empty operationId`);
      }
      if (operationIds.has(operation.operationId)) throw new Error(`Duplicate OpenAPI operationId: ${operation.operationId}`);
      operationIds.add(operation.operationId);
      operationCount++;
      if (!isObject(operation.responses) || Object.keys(operation.responses).length === 0) {
        throw new Error(`${operation.operationId} must declare responses`);
      }
      if (!Object.keys(operation.responses).some((status) => /^2\d\d$/.test(status))) {
        throw new Error(`${operation.operationId} must declare at least one 2xx response`);
      }
    }
  }
  if (operationCount === 0) throw new Error('Candidate OpenAPI document has no HTTP operations');
  checkReferences(document, document);
}

const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');
if (fileIndex < 0 || !args[fileIndex + 1]) throw new Error('Usage: npm run sync:openapi -- --file path/to/openapi.json [--source-label label]');
const sourceLabelIndex = args.indexOf('--source-label');
const sourceLabel = sourceLabelIndex >= 0 ? args[sourceLabelIndex + 1] : undefined;
if (sourceLabelIndex >= 0 && (!sourceLabel || sourceLabel.trim() === '')) throw new Error('--source-label requires a non-empty value');

const source = resolve(args[fileIndex + 1]!);
const bytes = await readFile(source);
const contents = bytes.toString('utf8');
let document: unknown;
try {
  document = JSON.parse(contents);
} catch {
  throw new Error('Candidate file is not valid JSON');
}
validateOpenApiDocument(document);

const target = resolve('openapi/adeli.openapi.json');
await mkdir(resolve('openapi'), { recursive: true });
await writeFile(target, bytes);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const provenance = {
  source: sourceLabel?.trim() || 'candidate-file',
  specUrl: 'candidate file',
  retrievedAt: new Date().toISOString(),
  sha256,
  upstreamCommit: null,
  status: 'candidate-unreleased',
};
await writeFile(resolve('openapi/provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`Copied candidate OpenAPI to ${target}\noperations: ${Object.values(document.paths as JsonObject).flatMap((item) => isObject(item) ? Object.keys(item).filter((method) => HTTP_METHODS.has(method)) : []).length}\nsha256: ${sha256}`);
