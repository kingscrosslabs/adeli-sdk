import { Adeli } from '../src/index.js';
import type { RefreshAccountsResponse } from '../src/resources/accounts.js';
import type { operations } from '../src/generated/api.js';

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const profile = {
  id: 'profile-1', name: 'Acme', externalId: 'customer-1', metadata: { tier: 'pro' },
  isDefault: true, createdAt: '2026-10-19T00:00:00.000Z', updatedAt: '2026-10-19T00:00:00.000Z',
};
const session = {
  id: 'session-1', profileId: 'profile-1', platform: 'instagram', status: 'pending_authorization',
  accountId: null, expiresAt: '2026-10-19T00:10:00.000Z', completedAt: null, error: null,
  authMethod: 'unified_login', authUrl: 'https://app.tryadeli.com/api/instagram/connect?state=opaque',
};
const account = {
  id: 'account-1', accountId: 'account-1', profileId: 'profile-1', platform: 'instagram',
  providerId: 'provider-1', displayName: '@acme', displayIdentifier: 'acme',
  authMethod: 'unified_login', connectionStatus: 'connected',
};
const aggregate = { status: 'complete', accounts: [account], errors: [] };
// An Instagram Unified Login token does not expire, so its refresh reports no expiry.
const refreshed = { id: 'account-1', accountId: 'account-1', profileId: 'profile-1', platform: 'instagram', refreshed: true, expiresAt: null };
const identity = {
  message: 'Hello from Adeli 👋 Your API key works.',
  you: { name: null, organization: 'Acme Inc.', profile: { id: 'profile-1', name: 'Acme' } },
  apiKey: { label: 'test', prefix: 'adeli_test', createdAt: '2026-10-19T00:00:00.000Z' },
  accountsConnected: [{ accountId: 'account-1', platform: 'instagram', username: 'acme' }],
  docs: 'https://www.tryadeli.com/docs',
};

test('covers every foundation operation with real handler paths and response envelopes', async () => {
  const fixtures = [
    { status: 200, data: identity },
    { status: 200, data: { profiles: [profile] } },
    { status: 201, data: profile },
    { status: 200, data: profile },
    { status: 200, data: profile },
    { status: 200, data: { id: 'profile-1', deleted: true } },
    { status: 201, data: session },
    { status: 200, data: session },
    { status: 200, data: aggregate },
    { status: 200, data: aggregate },
    { status: 200, data: account },
    { status: 200, data: { ...account, platform: 'x', providerId: 'x-1', xCapabilities: { analytics: false, inbox: true } } },
    { status: 200, data: { id: 'account-1', disconnected: true, revocationFailed: false } },
    { status: 200, data: { status: 'complete', accounts: [refreshed], errors: [] } },
  ] as const;
  const requests: Request[] = [];
  let call = 0;
  const client = new Adeli({ apiKey: 'key', baseURL: 'http://localhost:3000', fetch: async (input, init) => {
    requests.push(new Request(input, init));
    const fixture = fixtures[call++];
    if (!fixture) throw new Error('unexpected request');
    return response(fixture.status, fixture.data);
  } });

  const results = [
    await client.getMe({ query: { profileId: 'profile-1' } }),
    await client.profiles.listProfiles(),
    await client.profiles.createProfile({ body: { name: 'Acme', externalId: 'customer-1', metadata: { tier: 'pro' } } }, { idempotencyKey: 'profile-v1' }),
    await client.profiles.getProfile({ path: { profileId: 'profile-1' } }),
    await client.profiles.updateProfile({ path: { profileId: 'profile-1' }, body: { name: 'Acme', externalId: 'customer-1', metadata: { tier: 'pro' } } }),
    await client.profiles.deleteProfile({ path: { profileId: 'profile-1' } }),
    await client.profiles.startConnection({ path: { profileId: 'profile-1' }, body: { platform: 'instagram', redirectUrl: 'https://customer.example/callback' } }),
    await client.profiles.getConnection({ path: { profileId: 'profile-1', connectionSessionId: 'session-1' } }),
    await client.accounts.listAccounts({ query: { profileId: 'profile-1', platform: 'instagram' } }),
    await client.accounts.listProfileAccounts({ path: { profileId: 'profile-1' } }),
    await client.accounts.getAccount({ path: { profileId: 'profile-1', accountId: 'account-1' } }),
    await client.accounts.updateAccount({ path: { profileId: 'profile-1', accountId: 'account-1' }, body: { xCapabilities: { inbox: true } } }),
    await client.accounts.disconnectAccount({ path: { profileId: 'profile-1', accountId: 'account-1' } }),
    await client.accounts.refreshAccounts({ path: { profileId: 'profile-1' } }),
  ];

  expect(results.map((result) => result.data)).toEqual(fixtures.map((fixture) => fixture.data));
  expect(requests.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toEqual([
    'GET /api/v1/me',
    'GET /api/v1/profiles',
    'POST /api/v1/profiles',
    'GET /api/v1/profiles/profile-1',
    'PUT /api/v1/profiles/profile-1',
    'DELETE /api/v1/profiles/profile-1',
    'POST /api/v1/profiles/profile-1/connect',
    'GET /api/v1/profiles/profile-1/connect/session-1',
    'GET /api/v1/accounts',
    'GET /api/v1/profiles/profile-1/accounts',
    'GET /api/v1/profiles/profile-1/accounts/account-1',
    'PATCH /api/v1/profiles/profile-1/accounts/account-1',
    'DELETE /api/v1/profiles/profile-1/accounts/account-1',
    'POST /api/v1/profiles/profile-1/accounts/refresh',
  ]);
  expect(new URL(requests[0]!.url).search).toBe('?profileId=profile-1');
  expect(new URL(requests[8]!.url).search).toBe('?profileId=profile-1&platform=instagram');
  expect(requests[2]!.headers.get('idempotency-key')).toBe('profile-v1');
  await expect(requests[2]!.clone().json()).resolves.toEqual({ name: 'Acme', externalId: 'customer-1', metadata: { tier: 'pro' } });
  await expect(requests[11]!.clone().json()).resolves.toEqual({ xCapabilities: { inbox: true } });
});

test('types Instagram Unified Login: the new authMethod and a refresh with no expiry', () => {
  type StartBody = NonNullable<operations['startConnection']['requestBody']>['content']['application/json'];
  expectTypeOf<'unified_login'>().toMatchTypeOf<NonNullable<StartBody['authMethod']>>();
  // The deprecated values stay accepted on the wire.
  expectTypeOf<'instagram_login' | 'facebook_login'>().toMatchTypeOf<NonNullable<StartBody['authMethod']>>();
  expectTypeOf<RefreshAccountsResponse['accounts'][number]['expiresAt']>().toEqualTypeOf<string | null>();
});
