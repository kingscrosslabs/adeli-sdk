import { readFile } from 'node:fs/promises';
import { operations } from '../src/operations.js';

type JsonObject = Record<string, unknown>;
type Response = { content?: JsonObject; description?: unknown };
type Operation = { operationId?: unknown; responses?: Record<string, Response> };
type Document = { paths?: Record<string, Record<string, Operation | unknown>>; [key: string]: unknown };

const fileArgument = process.argv.indexOf('--file');
if (fileArgument >= 0 && process.argv[fileArgument + 1] === undefined) throw new Error('--file requires an OpenAPI document path');
const contractFile = fileArgument >= 0 ? process.argv[fileArgument + 1]! : 'openapi/adeli.openapi.json';
const document = JSON.parse(await readFile(contractFile, 'utf8')) as Document;
const root = document as unknown as JsonObject;
const errors: string[] = [];
const suspicious: string[] = [];
const contract = new Map<string, { method: string; path: string }>();
const metadataById = new Map<string, { method: string; path: string }>();
// OpenAPI Path Item operation fields; parameters, summary, description, and servers are not operations.
const httpMethods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isOperation(value: unknown): value is Operation {
  return isObject(value) && ('operationId' in value || 'responses' in value);
}
function pointerDecode(part: string): string { return part.replaceAll('~1', '/').replaceAll('~0', '~'); }

for (const [path, methods] of Object.entries(document.paths ?? {})) {
  for (const [method, candidate] of Object.entries(methods)) {
    if (!httpMethods.has(method)) continue;
    if (!isOperation(candidate)) {
      errors.push(`${method.toUpperCase()} ${path} is not an operation object`);
      continue;
    }
    const id = candidate.operationId;
    if (typeof id !== 'string' || id.length === 0) {
      errors.push(`${method.toUpperCase()} ${path} has no operationId`);
      continue;
    }
    const location = { method: method.toUpperCase(), path };
    const prior = contract.get(id);
    if (prior) errors.push(`duplicate operationId ${id}: ${prior.method} ${prior.path} and ${location.method} ${location.path}`);
    contract.set(id, location);
    if (!path.startsWith('/api/v1/')) errors.push(`${id} is outside the /api/v1 API prefix`);
    const normalizedPath = path.replace(/^\/api\/v1/, '');
    metadataById.set(id, { method: location.method, path: normalizedPath });

    const successResponses = Object.entries(candidate.responses ?? {}).filter(([code]) => /^2\d\d$/.test(code));
    if (successResponses.length === 0) errors.push(`${id} has no 2xx response`);
    for (const [status, response] of successResponses) {
      if (status === '204') {
        if (response.content && Object.keys(response.content).length > 0) suspicious.push(`${id} 204 declares content; verify no-content semantics`);
        continue;
      }
      const content = response.content;
      const media = content && (content['application/json'] ?? Object.values(content)[0]);
      const schema = isObject(media) ? media.schema : undefined;
      if (!isObject(schema)) {
        errors.push(`${id} ${status} has no success response schema`);
        suspicious.push(`${id} ${status} requires human response-contract review`);
      } else if (!hasMeaningfulSuccessShape(schema)) {
        errors.push(`${id} ${status} uses an unconstrained success response schema`);
        suspicious.push(`${id} ${status} is not meaningfully typed and requires human response-contract review`);
      }
    }
  }
}

const implemented = new Set(Object.keys(operations));
const missing = [...contract.keys()].filter(id => !implemented.has(id));
const extra = [...implemented].filter(id => !contract.has(id));
if (missing.length) errors.push(`implemented operation coverage is incomplete; missing: ${missing.join(', ')}`);
if (extra.length) errors.push(`SDK metadata contains operations absent from OpenAPI: ${extra.join(', ')}`);
for (const [id, operation] of Object.entries(operations)) {
  const contractOperation = metadataById.get(id);
  if (!contractOperation) continue;
  if (operation.method !== contractOperation.method || operation.path !== contractOperation.path) {
    errors.push(`${id} metadata differs from OpenAPI (${operation.method} ${operation.path} vs ${contractOperation.method} ${contractOperation.path})`);
  }
}

function hasRef(ref: string): boolean {
  if (!ref.startsWith('#/')) return true;
  let value: unknown = root;
  for (const part of ref.slice(2).split('/')) value = isObject(value) ? value[pointerDecode(part)] : undefined;
  return value !== undefined;
}
function checkRefs(value: unknown, location = 'document'): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => checkRefs(child, `${location}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  if (typeof value.$ref === 'string' && !hasRef(value.$ref)) errors.push(`missing OpenAPI reference ${value.$ref} at ${location}`);
  for (const [key, child] of Object.entries(value)) checkRefs(child, `${location}.${key}`);
}
function resolveLocalRef(ref: string): JsonObject | undefined {
  if (ref === '#') return root;
  if (!ref.startsWith('#/')) return undefined;
  let value: unknown = root;
  for (const part of ref.slice(2).split('/')) value = isObject(value) ? value[pointerDecode(part)] : undefined;
  return isObject(value) ? value : undefined;
}

/**
 * Require a response root to constrain a consumer-visible value. Nested
 * extension bags may remain open; a root object with no fields or untyped map
 * does not describe a useful response shape.
 */
function hasMeaningfulSuccessShape(schema: JsonObject, resolving = new Set<string>()): boolean {
  const ref = schema.$ref;
  if (typeof ref === 'string') {
    if (!ref.startsWith('#')) return false;
    if (resolving.has(ref)) return false;
    const resolved = resolveLocalRef(ref);
    if (resolved === undefined) return false;
    resolving.add(ref);
    const meaningful = hasMeaningfulSuccessShape(resolved, resolving);
    resolving.delete(ref);
    if (meaningful) return true;
  }

  if ('const' in schema || (Array.isArray(schema.enum) && schema.enum.length > 0)) return true;
  const type = schema.type;
  const direct = typeof type === 'string'
    ? hasMeaningfulTypedShape(type, schema, resolving)
    : Array.isArray(type) && type.length > 0 && type.every(candidate => typeof candidate === 'string' && hasMeaningfulTypedShape(candidate, schema, resolving));
  if (direct) return true;

  const allOf = Array.isArray(schema.allOf) ? schema.allOf : [];
  if (allOf.some(candidate => isObject(candidate) && hasMeaningfulSuccessShape(candidate, resolving))) return true;
  for (const alternatives of [schema.anyOf, schema.oneOf]) {
    if (Array.isArray(alternatives) && alternatives.length > 0
      && alternatives.every(candidate => isObject(candidate) && hasMeaningfulSuccessShape(candidate, resolving))) return true;
  }
  return false;
}

function hasMeaningfulTypedShape(type: string, schema: JsonObject, resolving: Set<string>): boolean {
  if (type === 'object') {
    if (isObject(schema.properties) && Object.keys(schema.properties).length > 0) return true;
    if (schema.additionalProperties === false) return true;
    return isObject(schema.additionalProperties) && hasMeaningfulSuccessShape(schema.additionalProperties, resolving);
  }
  if (type === 'array') return isObject(schema.items) && hasMeaningfulSuccessShape(schema.items, resolving);
  return ['string', 'number', 'integer', 'boolean', 'null'].includes(type);
}
checkRefs(document);

if (suspicious.length) {
  console.error('Contract review required (this checker does not infer all semantic changes):');
  for (const item of [...new Set(suspicious)]) console.error(`- ${item}`);
}
if (errors.length) {
  console.error('Contract check failed:');
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Contract check passed: ${contract.size} operations; useful success schemas, references, and metadata are valid`);
}
