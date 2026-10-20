import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

type JsonObject = Record<string, unknown>;
type Contract = JsonObject & { paths: Record<string, Record<string, { responses: Record<string, { content: Record<string, { schema: JsonObject }> }> }>>; components: { schemas: Record<string, JsonObject> } };

const repository = resolve('.');
const sourceContract = JSON.parse(await readFile(join(repository, 'openapi/adeli.openapi.json'), 'utf8')) as Contract;

function getMeSchema(contract: Contract): JsonObject {
  return contract.paths['/api/v1/me']!.get!.responses['200']!.content['application/json']!.schema;
}

function checkerEnvironment(directory: string): NodeJS.ProcessEnv {
  return {
    HOME: join(directory, 'home'),
    TMPDIR: directory,
    TZ: 'UTC',
    NO_PROXY: '*',
    npm_config_cache: join(directory, 'npm-cache'),
    npm_config_userconfig: join(directory, 'npmrc'),
    npm_config_offline: 'true',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
  };
}

async function runContractChecker(mutator: (contract: Contract) => void, temporaryRoot = tmpdir()): Promise<{ status: number | null; output: string }> {
  const directory = await mkdtemp(join(temporaryRoot, 'adeli-sdk-contract-checker-'));
  try {
    const environment = checkerEnvironment(directory);
    await Promise.all([
      mkdir(environment.HOME!),
      mkdir(environment.npm_config_cache!),
      writeFile(environment.npm_config_userconfig!, 'offline=true\naudit=false\nfund=false\nupdate-notifier=false\n'),
    ]);
    const contract = structuredClone(sourceContract);
    mutator(contract);
    const file = join(directory, 'contract.json');
    await writeFile(file, JSON.stringify(contract));
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-contract.ts', '--file', file], { cwd: repository, encoding: 'utf8', env: environment });
    if (result.error) throw result.error;
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('checker CLI fixture excludes inherited preloads and credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'adeli-sdk-contract-checker-preload-'));
  const preload = join(directory, 'unexpected-preload.cjs');
  const priorNodeOptions = process.env.NODE_OPTIONS;
  const priorCredential = process.env.ADELI_CHECKER_TEST_CREDENTIAL;
  try {
    await writeFile(preload, "throw new Error('checker fixture inherited NODE_OPTIONS');\n");
    process.env.NODE_OPTIONS = `--require=${preload}`;
    process.env.ADELI_CHECKER_TEST_CREDENTIAL = 'must-not-reach-checker-child';
    const environment = checkerEnvironment(directory);
    expect(environment).not.toHaveProperty('NODE_OPTIONS');
    expect(environment).not.toHaveProperty('ADELI_CHECKER_TEST_CREDENTIAL');
    const result = await runContractChecker(contract => contract);
    expect(result.status).toBe(0);
    expect(result.output).toContain('Contract check passed');
  } finally {
    if (priorNodeOptions === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = priorNodeOptions;
    if (priorCredential === undefined) delete process.env.ADELI_CHECKER_TEST_CREDENTIAL;
    else process.env.ADELI_CHECKER_TEST_CREDENTIAL = priorCredential;
    await rm(directory, { recursive: true, force: true });
  }
});

test('checker CLI runs under a long owned temporary path', async () => {
  const ownedRoot = await mkdtemp(join(tmpdir(), 'adeli-sdk-contract-checker-long-owned-path-'));
  const longRoot = join(ownedRoot, 'temporary-path-segment-'.repeat(4));
  try {
    await mkdir(longRoot);
    const result = await runContractChecker(contract => contract, longRoot);
    expect(result.status).toBe(0);
    expect(result.output).toContain('Contract check passed');
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
});

test.each([
  ['the pinned candidate', (contract: Contract) => contract],
  ['a local composed reference with an open nested extension field', (contract: Contract) => {
    contract.components.schemas.ContractCheckerFields = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] };
    contract.components.schemas.ContractCheckerResponse = {
      allOf: [
        { $ref: '#/components/schemas/ContractCheckerFields' },
        { type: 'object', properties: { extension: { type: 'object', additionalProperties: true } } },
      ],
    };
    Object.assign(getMeSchema(contract), { $ref: '#/components/schemas/ContractCheckerResponse' });
    for (const key of Object.keys(getMeSchema(contract))) if (key !== '$ref') delete getMeSchema(contract)[key];
  }],
  ['a typed map root', (contract: Contract) => {
    const schema = getMeSchema(contract);
    for (const key of Object.keys(schema)) delete schema[key];
    Object.assign(schema, { type: 'object', additionalProperties: { type: 'string' } });
  }],
])('check:contract accepts %s', async (_name, mutator) => {
  const result = await runContractChecker(mutator);
  expect(result.status).toBe(0);
  expect(result.output).toContain('Contract check passed');
});

test('check:contract rejects an unimplemented HEAD operation', async () => {
  const result = await runContractChecker(contract => {
    contract.paths['/api/v1/health'] = {
      head: { operationId: 'headHealth', responses: { 204: { description: 'No content' } } },
    } as unknown as Contract['paths'][string];
  });
  expect(result.status).toBe(1);
  expect(result.output).toContain('implemented operation coverage is incomplete; missing: headHealth');
});

test.each([
  ['an empty schema', (contract: Contract) => {
    const schema = getMeSchema(contract);
    for (const key of Object.keys(schema)) delete schema[key];
  }],
  ['a reference to an unhelpful object', (contract: Contract) => {
    contract.components.schemas.UnhelpfulResponse = { type: 'object' };
    const schema = getMeSchema(contract);
    for (const key of Object.keys(schema)) delete schema[key];
    schema.$ref = '#/components/schemas/UnhelpfulResponse';
  }],
  ['an open object root', (contract: Contract) => {
    const schema = getMeSchema(contract);
    for (const key of Object.keys(schema)) delete schema[key];
    Object.assign(schema, { type: 'object', additionalProperties: true });
  }],
  ['a circular local reference', (contract: Contract) => {
    contract.components.schemas.ContractCheckerCycleA = { $ref: '#/components/schemas/ContractCheckerCycleB' };
    contract.components.schemas.ContractCheckerCycleB = { $ref: '#/components/schemas/ContractCheckerCycleA' };
    const schema = getMeSchema(contract);
    for (const key of Object.keys(schema)) delete schema[key];
    schema.$ref = '#/components/schemas/ContractCheckerCycleA';
  }],
])('check:contract rejects %s', async (_name, mutator) => {
  const result = await runContractChecker(mutator);
  expect(result.status).toBe(1);
  expect(result.output).toContain('getMe 200 uses an unconstrained success response schema');
});
