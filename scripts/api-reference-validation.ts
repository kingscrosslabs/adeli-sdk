export interface ApiReferenceOperation {
  readonly method: string;
  readonly path: string;
}

export interface ApiReferenceDocsEndpoint {
  readonly method: string;
  readonly path: string;
  readonly href: string;
}

export function validateMethodCoverage(operationIds: readonly string[], methodNames: ReadonlySet<string>): void {
  for (const operationId of operationIds) {
    if (!methodNames.has(operationId)) throw new Error(`No AST-extracted public method declaration for ${operationId}`);
  }
}

export function validateDocsLinks(
  operations: Readonly<Record<string, ApiReferenceOperation>>,
  mappings: Readonly<Record<string, readonly ApiReferenceDocsEndpoint[]>>,
  baseUrl: string | undefined,
): void {
  const operationIds = Object.keys(operations);
  if (new Set(Object.keys(mappings)).size !== operationIds.length || operationIds.some((id) => mappings[id] === undefined) || Object.keys(mappings).some((id) => !(id in operations))) {
    throw new Error('openapi/docs-links.json must contain exactly one mapping entry for every SDK operation');
  }
  if (baseUrl !== 'https://www.tryadeli.com') throw new Error('openapi/docs-links.json must use the verified HTTPS public docs origin');
  for (const [operationId, operation] of Object.entries(operations)) {
    const entries = mappings[operationId]!;
    if (entries.length === 0) throw new Error(`No public docs mapping for ${operationId}`);
    if (operationId === 'createPost' && entries.length < 6) throw new Error('createPost must retain all six verified platform documentation pages');
    if (operationId === 'getXUsage' && entries[0]?.href !== '/docs/pricing/x') throw new Error('getXUsage must link the verified stored-usage ledger page');
    for (const entry of entries) {
      if (entry.method !== operation.method || entry.path !== `/api/v1${operation.path}`) throw new Error(`Docs mapping for ${operationId} does not match ${operation.method} /api/v1${operation.path}`);
      if (!entry.href.startsWith('/docs/') || entry.href.includes('//')) throw new Error(`Docs mapping for ${operationId} is not a public docs path: ${entry.href}`);
      const url = new URL(entry.href, baseUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'www.tryadeli.com') throw new Error(`Docs mapping for ${operationId} is not an HTTPS Adeli URL: ${entry.href}`);
    }
  }
}
