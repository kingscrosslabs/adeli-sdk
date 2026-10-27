import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { operations } from '../src/operations.js';
import { validateDocsLinks, validateMethodCoverage } from './api-reference-validation.js';

const outputArgument = process.argv.slice(2).find((argument) => argument === '--output' || argument.startsWith('--output='));
const outputIndex = process.argv.indexOf('--output');
const outputPath = outputArgument?.startsWith('--output=') ? outputArgument.slice('--output='.length) : outputIndex >= 0 ? process.argv[outputIndex + 1] : 'docs/api-reference.md';
if (!outputPath) throw new Error('--output requires a file path');

const resourceFiles = ['src/client.ts', 'src/resources/profiles.ts', 'src/resources/accounts.ts', 'src/resources/posts.ts', 'src/resources/comments.ts', 'src/resources/messages.ts', 'src/resources/analytics.ts', 'src/resources/ads.ts', 'src/resources/usage.ts'];
const source = new Map<string, string>();
for (const file of resourceFiles) source.set(file, await readFile(file, 'utf8'));
const provenance = JSON.parse(await readFile('openapi/provenance.json', 'utf8')) as { sha256?: string; status?: string };
const docsLinks = JSON.parse(await readFile('openapi/docs-links.json', 'utf8')) as {
  source?: string;
  baseUrl?: string;
  operations?: Record<string, { method: string; path: string; href: string }[]>;
};
const tick = String.fromCharCode(96);

type MethodSource = { readonly file: string; readonly signature: string };
const methodSources = new Map<string, MethodSource>();
for (const [file, text] of source) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function visit(node: ts.Node): void {
    if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      if (name === 'constructor' || name.startsWith('_')) return;
      if (methodSources.has(name)) throw new Error(`Duplicate public resource method ${name} in ${file} and ${methodSources.get(name)!.file}`);
      const parameters = node.parameters.map((parameter) => parameter.getText(ast)).join(', ');
      const returnType = node.type === undefined ? '' : `: ${node.type.getText(ast)}`;
      methodSources.set(name, { file, signature: `${tick}${name}(${parameters})${returnType}${tick}` });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

const linkOperations = docsLinks.operations ?? {};
validateMethodCoverage(Object.keys(operations), new Set(methodSources.keys()));
validateDocsLinks(operations, linkOperations, docsLinks.baseUrl);

const resourceName = (operationId: string): string => operationId === 'getMe' ? 'Adeli' : ({
  listProfiles: 'profiles', createProfile: 'profiles', getProfile: 'profiles', updateProfile: 'profiles', deleteProfile: 'profiles', startConnection: 'profiles', getConnection: 'profiles',
  listAccounts: 'accounts', listProfileAccounts: 'accounts', getAccount: 'accounts', updateAccount: 'accounts', disconnectAccount: 'accounts', refreshAccounts: 'accounts',
  listPosts: 'posts', createPost: 'posts', uploadYouTubeVideo: 'posts', deleteXPost: 'posts', deleteBlueskyPost: 'posts', getFacebookPostStatus: 'posts', getTikTokPostStatus: 'posts', getTikTokCreatorInfo: 'posts', getYouTubeVideoStatus: 'posts',
  listComments: 'comments', createComment: 'comments', updateComment: 'comments', deleteComment: 'comments', listMessages: 'messages', sendMessage: 'messages',
  getInstagramAccountInsights: 'analytics', getFacebookPageMetrics: 'analytics', getTikTokAccountAnalytics: 'analytics', getTikTokAccountInsights: 'analytics', getTikTokVideoInsights: 'analytics', getYouTubeChannelInsights: 'analytics', getYouTubeVideoInsights: 'analytics',
  listAdBusinesses: 'ads', listAdAccounts: 'ads', createAdAccount: 'ads', getAdAccount: 'ads', updateAdAccount: 'ads', getAdTree: 'ads', getAdInsights: 'ads', listAdLeads: 'ads', createCampaign: 'ads', deleteCampaign: 'ads', setAdStatus: 'ads', getXUsage: 'usage',
} as Record<string, string>)[operationId] ?? 'unknown';
function escapeCell(value: string): string { return value.replaceAll('|', '\\|').replaceAll('\n', ' '); }
function endpointLinks(operationId: string): string {
  return linkOperations[operationId]!.map((entry) => `[${entry.href.replace('/docs/', '')}](${docsLinks.baseUrl}${entry.href})`).join('<br>');
}

let output = `# API reference\n\nGenerated from ${tick}src/operations.ts${tick} metadata, AST-extracted resource method declarations, and the checked-in verified public docs mapping ${tick}openapi/docs-links.json${tick}; this file is not hand-maintained.\n\n- Contract status: **${provenance.status ?? 'unknown'}**\n- Candidate OpenAPI SHA-256: ${tick}${provenance.sha256 ?? 'unknown'}${tick}\n- Public endpoint documentation: ${docsLinks.baseUrl}/docs/\n\n| Resource | Method signature | HTTP | Path | Endpoint docs |\n| --- | --- | --- | --- | --- |\n`;
for (const [operationId, operation] of Object.entries(operations)) {
  const signature = methodSources.get(operationId)!.signature;
  output += `| ${escapeCell(resourceName(operationId))} | ${escapeCell(signature)} | ${operation.method} | ${escapeCell(`${tick}${operation.path}${tick}`)} | ${endpointLinks(operationId)} |\n`;
}
output += `\n## Compatibility note\n\nThe SHA-256 above identifies a local, unreleased candidate snapshot. It is provenance, not proof of deployment or npm publication. Regenerate after a reviewed contract update and inspect status, nullability, error, and provider-outcome changes.\n`;
await writeFile(outputPath, output);
