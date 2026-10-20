import { mkdtemp, rm, stat, truncate, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Adeli } from '../src/index.js';
import { fileFromPath } from '../src/uploads.js';

const ok = () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
const id = '00000000-0000-0000-0000-000000000001';
const temporaryRoots = new Set<string>();
afterEach(async () => { for (const root of temporaryRoots) await rm(root, { recursive: true, force: true }); temporaryRoots.clear(); });

test('invokes every operation through the public resource surface', async () => {
  const requests: Request[] = [];
  const client = new Adeli({ apiKey: 'key', baseURL: 'http://localhost', fetch: async (input, init) => { requests.push(new Request(input, init)); return ok(); } });
  await Promise.all([
    client.getMe({}), client.profiles.listProfiles({}), client.profiles.createProfile({ body: { name: 'p' } }), client.profiles.getProfile({ path: { profileId: id } }),
    client.profiles.updateProfile({ path: { profileId: id }, body: { name: 'p' } }), client.profiles.deleteProfile({ path: { profileId: id } }),
    client.profiles.startConnection({ path: { profileId: id }, body: { platform: 'youtube' } }), client.profiles.getConnection({ path: { profileId: id, connectionSessionId: id } }),
    client.accounts.listAccounts({}), client.accounts.listProfileAccounts({ path: { profileId: id } }), client.accounts.getAccount({ path: { profileId: id, accountId: id } }),
    client.accounts.updateAccount({ path: { profileId: id, accountId: id }, body: { xCapabilities: { analytics: false } } }), client.accounts.disconnectAccount({ path: { profileId: id, accountId: id } }), client.accounts.refreshAccounts({ path: { profileId: id } }),
    client.posts.listPosts({}), client.posts.createPost({ body: { platform: 'x', accountId: id, text: 'hello' } }), client.posts.uploadYouTubeVideo({ body: { accountId: id, video: new Blob(['x'], { type: 'video/mp4' }), title: 'v', privacy_status: 'private', made_for_kids: false } }),
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
    client.ads.deleteCampaign({ path: { campaignId: id }, query: { adAccountId: 'act_1' } }), client.ads.setAdStatus({ body: { adAccountId: 'act_1', objectId: '1', status: 'PAUSED' } }), client.usage.getXUsage({}),
  ]);
  expect(requests).toHaveLength(48);
  expect(new Set(requests.map((request) => `${request.method} ${new URL(request.url).pathname}`)).size).toBe(48);
});

test('sends typed TikTok multipart fields and file-backed upload bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'adeli-upload-')); temporaryRoots.add(root);
  const path = join(root, 'photo.jpg');
  await writeFile(path, Buffer.from('jpeg-bytes'));
  const file = await fileFromPath(path, { contentType: 'image/jpeg' });
  expect(file.name).toBe('photo.jpg');
  expect((await stat(path)).size).toBe(await file.size);
  let seen: FormData | undefined;
  const client = new Adeli({ apiKey: 'key', baseURL: 'http://localhost', fetch: async (input, init) => {
    seen = await new Request(input, init).formData();
    return ok();
  } });
  await client.posts.createPost({ body: { platform: 'tiktok', accountId: id, photos: [file], disable_comment: false, photo_cover_index: 0, music_usage_confirmed: true } });
  expect(seen?.get('platform')).toBe('tiktok');
  expect(seen?.get('disable_comment')).toBe('false');
  expect(seen?.get('photo_cover_index')).toBe('0');
  expect((seen?.getAll('photos[]')[0] as File).name).toBe('photo.jpg');
  await rm(root, { recursive: true, force: true });
});

test('file-backed adapter starts large sparse files with bounded chunks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'adeli-large-upload-')); temporaryRoots.add(root);
  const path = join(root, 'large.mp4');
  await writeFile(path, '');
  await truncate(path, 64 * 1024 * 1024);
  const file = await fileFromPath(path, { contentType: 'video/mp4' });
  expect(file.size).toBe(64 * 1024 * 1024);
  const reader = file.stream().getReader();
  const first = await reader.read();
  expect(first.done).toBe(false);
  expect(first.value?.byteLength).toBeLessThan(1024 * 1024);
  await reader.cancel();
  await rm(root, { recursive: true, force: true });
});

test('local receiver observes multipart boundary, MIME, and repeated file order', async () => {
  const root = await mkdtemp(join(tmpdir(), 'adeli-wire-')); temporaryRoots.add(root);
  const firstPath = join(root, 'first.jpg');
  await writeFile(firstPath, 'first');
  const first = await fileFromPath(firstPath, { contentType: 'image/jpeg' });
  const secondPath = join(root, 'second.webp');
  await writeFile(secondPath, 'second');
  const second = await fileFromPath(secondPath, { contentType: 'image/webp' });
  const received: { contentType: string; bytes: Buffer }[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => { received.push({ contentType: request.headers['content-type'] ?? '', bytes: Buffer.concat(chunks) }); response.writeHead(200, { 'content-type': 'application/json' }).end('{}'); });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('local receiver did not bind');
    const client = new Adeli({ apiKey: 'key', baseURL: `http://127.0.0.1:${address.port}`, fetch: globalThis.fetch });
    await client.posts.createPost({ body: { platform: 'tiktok', accountId: id, photos: [first, second], music_usage_confirmed: true } });
    const thumbnailPath = join(root, 'thumbnail.png');
    await writeFile(thumbnailPath, 'thumbnail');
    const videoPath = join(root, 'video.mp4');
    await writeFile(videoPath, 'video');
    await client.posts.uploadYouTubeVideo({ body: { accountId: id, video: await fileFromPath(videoPath, { contentType: 'video/mp4', name: 'override.mp4' }), thumbnail: await fileFromPath(thumbnailPath, { contentType: 'image/png', name: 'thumb-override.png' }), title: 'Title', tags: ['one', 'two'], privacy_status: 'private', made_for_kids: false, notify_subscribers: false } });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  const wire = received[0]?.bytes.toString('latin1') ?? '';
  expect(received[0]?.contentType).toMatch(/^multipart\/form-data; boundary=/);
  expect(wire).toContain('filename="first.jpg"');
  expect(wire).toContain('filename="second.webp"');
  expect(wire.indexOf('filename="first.jpg"')).toBeLessThan(wire.indexOf('filename="second.webp"'));
  expect(wire).toContain('Content-Type: image/jpeg');
  expect(wire).toContain('Content-Type: image/webp');
  const youtubeWire = received[1]?.bytes.toString('latin1') ?? '';
  expect(received[1]?.contentType).toMatch(/^multipart\/form-data; boundary=/);
  expect(youtubeWire).toContain('filename="override.mp4"');
  expect(youtubeWire).toContain('filename="thumb-override.png"');
  expect(youtubeWire).toContain('Content-Type: video/mp4');
  expect(youtubeWire).toContain('Content-Type: image/png');
  expect(youtubeWire).toContain('name="tags"');
  expect(youtubeWire).toContain('one,two');
  expect(youtubeWire).toContain('name="made_for_kids"');
  expect(youtubeWire).toContain('false');
  expect(youtubeWire).toContain('name="notify_subscribers"');
  expect(youtubeWire).toContain('false');
  await rm(root, { recursive: true, force: true });
});
