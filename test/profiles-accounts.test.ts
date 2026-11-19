import { Adeli, InstagramCapabilities } from '../src/index.js';

function json(status: number, data: unknown) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }); }
test('profiles and accounts preserve wire data and operation paths', async () => {
  const requests: Request[] = [];
  const client = new Adeli({ apiKey: 'k', baseURL: 'http://localhost:3000', fetch: async (input, init) => { requests.push(new Request(input, init)); return json(200, { id: 'x', platform: 'instagram' }); } });
  await client.profiles.getProfile({ path: { profileId: 'p/1' } });
  await client.profiles.startConnection({ path: { profileId: 'p' }, body: { platform: 'instagram', redirectUrl: 'https://example.test/callback' } });
  await client.profiles.getConnection({ path: { profileId: 'p', connectionSessionId: 'session' } });
  await client.accounts.listProfileAccounts({ path: { profileId: 'p' } });
  await client.accounts.getAccount({ path: { profileId: 'p', accountId: 'a' } });
  expect(requests.map(r => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
    'GET /api/v1/profiles/p%2F1', 'POST /api/v1/profiles/p/connect', 'GET /api/v1/profiles/p/connect/session', 'GET /api/v1/profiles/p/accounts', 'GET /api/v1/profiles/p/accounts/a'
  ]);
});

test('an Instagram connect can ask for only the capabilities a product uses', async () => {
  const requests: Request[] = [];
  const client = new Adeli({ apiKey: 'k', baseURL: 'http://localhost:3000', fetch: async (input, init) => { requests.push(new Request(input, init)); return json(201, { id: 's', platform: 'instagram', requestedPermissions: [{ code: 'instagram_business_basic', label: 'Instagram profile and media' }] }); } });
  const started = await client.profiles.startConnection({
    path: { profileId: 'p' },
    body: { platform: 'instagram', capabilities: [...InstagramCapabilities.engagement], forceReauth: false },
  });
  expect(await requests[0]!.json()).toEqual({
    platform: 'instagram',
    capabilities: ['profile.read', 'feed.read', 'comments.read', 'comments.manage', 'inbox.read', 'inbox.send'],
    forceReauth: false,
  });
  expect(started.data.requestedPermissions).toEqual([{ code: 'instagram_business_basic', label: 'Instagram profile and media' }]);
});

test('the engagement preset leaves out publishing and Insights', () => {
  const engagement: readonly string[] = InstagramCapabilities.engagement;
  expect(engagement).not.toContain('post.publish');
  expect(engagement.some(capability => capability.includes('analytics'))).toBe(false);
  expect(InstagramCapabilities.all).toEqual(expect.arrayContaining([...InstagramCapabilities.engagement, ...InstagramCapabilities.publishing]));
});
