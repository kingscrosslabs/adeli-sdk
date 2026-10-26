import { mkdtemp, rm, stat, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Adeli } from '../src/index.js';
import { fileFromPath } from '../src/uploads.js';

const ok = (body = '{}', status = 200) => new Response(body, { status, headers: { 'content-type': 'application/json' } });
const id = '00000000-0000-0000-0000-000000000001';
const temporaryRoots = new Set<string>();
afterEach(async () => { for (const root of temporaryRoots) await rm(root, { recursive: true, force: true }); temporaryRoots.clear(); });

function uploadAwareFetch(requests: Request[]) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init); requests.push(request);
    const url = new URL(request.url);
    if (url.hostname === 's3.example') return new Response('', { status: 200 });
    if (url.pathname === '/api/v1/media/uploads') {
      const body = await request.clone().json() as { files: Array<{ clientId: string; contentType: string }> };
      return ok(JSON.stringify({ uploads: body.files.map((file, index) => ({ clientId: file.clientId, uploadId: `staged-${index}`, method: 'PUT', url: `https://s3.example/${index}`, headers: { 'content-type': file.contentType, 'x-amz-meta-profile': id }, expiresAt: '2026-10-26T12:00:00Z' })) }), 201);
    }
    return ok();
  };
}

test('invokes every operation through the public resource surface', async () => {
  const requests: Request[] = [];
  const client = new Adeli({ apiKey: 'key', baseURL: 'http://localhost', fetch: uploadAwareFetch(requests) });
  await Promise.all([
    client.getMe({}), client.profiles.listProfiles({}), client.profiles.createProfile({ body: { name: 'p' } }), client.profiles.getProfile({ path: { profileId: id } }),
    client.profiles.updateProfile({ path: { profileId: id }, body: { name: 'p' } }), client.profiles.deleteProfile({ path: { profileId: id } }),
    client.profiles.startConnection({ path: { profileId: id }, body: { platform: 'youtube' } }), client.profiles.getConnection({ path: { profileId: id, connectionSessionId: id } }),
    client.accounts.listAccounts({}), client.accounts.listProfileAccounts({ path: { profileId: id } }), client.accounts.getAccount({ path: { profileId: id, accountId: id } }),
    client.accounts.updateAccount({ path: { profileId: id, accountId: id }, body: { xCapabilities: { analytics: false } } }), client.accounts.disconnectAccount({ path: { profileId: id, accountId: id } }), client.accounts.refreshAccounts({ path: { profileId: id } }),
    client.posts.listPosts({}), client.posts.createMediaUploads({ body: { profileId: id, platform: 'x', files: [{ clientId: '0', purpose: 'post_media', contentType: 'image/jpeg', size: 1 }] } }), client.posts.createPost({ body: { platform: 'x', accountId: id, text: 'hello' } }), client.posts.uploadYouTubeVideo({ body: { accountId: id, profileId: id, video: new Blob(['x'], { type: 'video/mp4' }), title: 'v', privacy_status: 'private', made_for_kids: false } }),
    client.posts.deleteXPost({ path: { postId: id }, query: { accountId: id } }), client.posts.deleteBlueskyPost({ path: { postId: id }, query: { accountId: id } }),
    client.posts.getFacebookPostStatus({ query: { accountId: id, publishId: 'p' } }), client.posts.getTikTokPostStatus({ query: { accountId: id, publishId: 'p' } }), client.posts.getTikTokCreatorInfo({ query: { accountId: id } }), client.posts.getYouTubeVideoStatus({ query: { accountId: id, videoId: 'v' } }),
    client.comments.listComments({ query: { platform: 'youtube', accountId: id } }), client.comments.createComment({ body: { platform: 'youtube', accountId: id, message: 'hi' } }),
    client.comments.updateComment({ path: { commentId: id }, body: { platform: 'youtube', accountId: id, liked: false } }), client.comments.deleteComment({ path: { commentId: id }, query: { platform: 'youtube', accountId: id } }),
    client.messages.listMessages({}), client.messages.sendMessage({ body: { platform: 'facebook', accountId: id, recipient: 'r', text: 'hi' } }),
    client.analytics.getInstagramAccountInsights({ query: { accountId: id } }), client.analytics.getFacebookPageMetrics({}), client.analytics.getTikTokAccountAnalytics({ query: { accountId: id } }),
    client.analytics.getTikTokAccountInsights({ query: { accountId: id } }), client.analytics.getTikTokVideoInsights({ query: { accountId: id } }), client.analytics.getYouTubeChannelInsights({ query: { accountId: id } }), client.analytics.getYouTubeVideoInsights({ query: { accountId: id } }),
    client.ads.listAdBusinesses({}), client.ads.listAdAccounts({}), client.ads.createAdAccount({ body: { businessId: 'b', name: 'a', timezone: 'UTC' } }, { idempotencyKey: 'a' }),
    client.ads.getAdAccount({ path: { adAccountId: 'act_1' } }), client.ads.updateAdAccount({ path: { adAccountId: 'act_1' }, body: { spendCap: 0 } }), client.ads.getAdTree({ query: { adAccountId: 'act_1' } }), client.ads.getAdInsights({ query: { adAccountId: 'act_1' } }), client.ads.listAdLeads({}),
    client.ads.createCampaign({ body: { adAccountId: 'act_1', pagePostId: '1', dailyBudget: 0, startDate: '2025-01-01', endDate: '2025-01-02', campaignName: 'c' } }, { idempotencyKey: 'c' }),
    client.ads.deleteCampaign({ path: { campaignId: id }, query: { adAccountId: 'act_1' } }), client.ads.setAdStatus({ body: { adAccountId: id, objectId: '1', status: 'PAUSED' } }), client.usage.getXUsage({}),
  ]);
  const apiRequests = requests.filter((request) => new URL(request.url).hostname === 'localhost');
  expect(new Set(apiRequests.map((request) => `${request.method} ${new URL(request.url).pathname}`)).size).toBe(49);
  expect(requests.some((request) => new URL(request.url).hostname === 's3.example')).toBe(true);
});

test('stages typed TikTok files with exact signed headers and sends only ordered references to Adeli', async () => {
  const root = await mkdtemp(join(tmpdir(), 'adeli-upload-')); temporaryRoots.add(root);
  const firstPath = join(root, 'first.jpg'); const secondPath = join(root, 'second.webp');
  await writeFile(firstPath, 'first'); await writeFile(secondPath, 'second');
  const first = await fileFromPath(firstPath, { contentType: 'image/jpeg' });
  const second = await fileFromPath(secondPath, { contentType: 'image/webp' });
  const requests: Request[] = [];
  const client = new Adeli({ apiKey: 'key', baseURL: 'http://localhost', fetch: uploadAwareFetch(requests) });
  const progress: Array<{ completedFiles: number; totalFiles: number }> = [];
  await client.posts.createPost({ body: { platform: 'tiktok', accountId: id, profileId: id, photos: [first, second], disable_comment: false, photo_cover_index: 0, music_usage_confirmed: true } }, { concurrency: 2, onProgress: (value) => progress.push(value) });
  const initiated = await requests[0]!.clone().json();
  expect(initiated).toMatchObject({ platform: 'tiktok', profileId: id, files: [{ clientId: '0', contentType: 'image/jpeg', filename: 'first.jpg' }, { clientId: '1', contentType: 'image/webp', filename: 'second.webp' }] });
  const puts = requests.filter((request) => new URL(request.url).hostname === 's3.example');
  expect(puts).toHaveLength(2);
  expect(puts[0]!.headers.get('authorization')).toBeNull();
  expect(puts[0]!.headers.get('x-amz-meta-profile')).toBe(id);
  expect(progress.at(-1)).toMatchObject({ completedFiles: 2, totalFiles: 2 });
  const final = await requests.at(-1)!.clone().json();
  expect(final).toMatchObject({ platform: 'tiktok', photos: [{ upload_id: 'staged-0' }, { upload_id: 'staged-1' }], disable_comment: false, photo_cover_index: 0 });
  expect(JSON.stringify(final)).not.toContain('first');
});

test('file-backed adapter starts large sparse files with bounded chunks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'adeli-large-upload-')); temporaryRoots.add(root);
  const path = join(root, 'large.mp4'); await writeFile(path, ''); await truncate(path, 64 * 1024 * 1024);
  const file = await fileFromPath(path, { contentType: 'video/mp4' });
  expect(file.size).toBe(64 * 1024 * 1024); expect((await stat(path)).size).toBe(file.size);
  const reader = file.stream().getReader(); const first = await reader.read();
  expect(first.done).toBe(false); expect(first.value?.byteLength).toBeLessThan(1024 * 1024);
  await reader.cancel();
});

test('stages YouTube video and thumbnail with distinct purposes before small JSON publication', async () => {
  const requests: Request[] = [];
  const client = new Adeli({ apiKey: 'key', baseURL: 'http://localhost', fetch: uploadAwareFetch(requests) });
  await client.posts.uploadYouTubeVideo({ body: { accountId: id, profileId: id, video: new File(['video'], 'video.mp4', { type: 'video/mp4' }), thumbnail: new File(['thumb'], 'thumb.png', { type: 'image/png' }), title: 'Title', tags: ['one', 'two'], privacy_status: 'private', made_for_kids: false, notify_subscribers: false } });
  const manifest = await requests[0]!.clone().json() as { files: Array<{ purpose: string }> };
  expect(manifest.files.map((file) => file.purpose)).toEqual(['post_media', 'youtube_thumbnail']);
  const finalRequest = requests.at(-1)!;
  expect(finalRequest.headers.get('content-type')).toBe('application/json');
  expect(await finalRequest.clone().json()).toMatchObject({ platform: 'youtube', video: { upload_id: 'staged-0' }, thumbnail: { upload_id: 'staged-1' }, tags: ['one', 'two'], notify_subscribers: false });
});
