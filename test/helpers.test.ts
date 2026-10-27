import { describe, expect, it } from 'vitest';
import { CancellationError, MalformedResponseError, TimeoutError, type ApiResponse } from '@adeli/sdk';
import { iterateCommentPages, iterateComments, waitForConnection, waitForFacebookPost, waitForInstagramPost, waitForTikTokPost, waitForYouTubeVideo } from '@adeli/sdk/helpers';

const response = <T>(data: T): ApiResponse<T> => ({ data, status: 200, headers: new Headers({ 'x-test': 'yes' }) });
const connection = (status: string): ApiResponse<any> => response({ id: 'session', profileId: 'profile', platform: 'facebook', status });
const tiktok = (status: string): ApiResponse<any> => response({ platform: 'tiktok', accountId: 'account', profileId: 'profile', publishId: 'publish', status, publicPostId: null, publicPostIds: [], failureReason: null, publiclyAvailable: null, source: 'provider' });
const instagram = (status: string): ApiResponse<any> => response({ jobId: 'job', platform: 'instagram', accountId: 'account', profileId: 'profile', status, statusUrl: '/api/v1/posts/instagram/status?jobId=job' });
const facebook = (status: string): ApiResponse<any> => response({ platform: 'facebook', accountId: 'account', profileId: 'profile', publishId: 'publish', status, phase: null, permalink: null, failureReason: null });
const youtube = (status: string): ApiResponse<any> => response({ platform: 'youtube', accountId: 'account', profileId: 'profile', videoId: 'video', status, uploadStatus: null, processingStatus: null, failureReason: null, privacyStatus: 'private', publishAt: null, permalink: null });
const pendingOptions = { timeoutMs: 1000, intervalMs: 1 };

function commentPage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    platform: 'tiktok', accountId: 'account', profileId: 'profile', postId: 'post-1',
    posts: [], comments: [{ id: 'comment-1', mediaId: 'post-1', body: 'unchanged' }],
    nextCursor: null, complete: false, syncedAt: null, ...overrides,
  };
}

describe('bounded polling helpers', () => {
  it.each(['pending_authorization', 'processing', 'pending_page_selection'])('continues connection polling for pending status %s', async status => {
    let calls = 0;
    const client = { profiles: { getConnection: async () => { calls += 1; return calls === 1 ? connection(status) : connection('connected'); } } };
    await expect(waitForConnection(client, { path: { profileId: 'profile', connectionSessionId: 'session' } }, pendingOptions)).resolves.toMatchObject({ data: { status: 'connected' } });
    expect(calls).toBe(2);
  });

  it('returns terminal connection/provider failures and preserves response metadata', async () => {
    let calls = 0;
    const client = { profiles: { getConnection: async () => { calls += 1; return calls === 1 ? connection('processing') : connection('failed'); } } };
    const result = await waitForConnection(client, { path: { profileId: 'profile', connectionSessionId: 'session' } }, pendingOptions);
    expect(result.data.status).toBe('failed');
    expect(result.headers.get('x-test')).toBe('yes');
    expect(calls).toBe(2);
  });

  it.each([
    ['facebook', 'PROCESSING'],
    ['youtube', 'processing'],
    ['tiktok', 'PROCESSING_UPLOAD'],
    ['tiktok', 'PROCESSING_DOWNLOAD'],
  ])('continues publishing polling for pending %s status %s', async (platform, status) => {
    let calls = 0;
    const client = { posts: {
      getTikTokPostStatus: async () => { calls += 1; return calls === 1 ? tiktok(status) : tiktok('PUBLISH_COMPLETE'); },
      getFacebookPostStatus: async () => { calls += 1; return calls === 1 ? facebook(status) : facebook('READY'); },
      getYouTubeVideoStatus: async () => { calls += 1; return calls === 1 ? youtube(status) : youtube('published'); },
    } };
    if (platform === 'tiktok') await waitForTikTokPost(client, { query: { accountId: 'account', publishId: 'publish' } }, pendingOptions);
    if (platform === 'facebook') await waitForFacebookPost(client, { query: { accountId: 'account', publishId: 'publish' } }, pendingOptions);
    if (platform === 'youtube') await waitForYouTubeVideo(client, { query: { accountId: 'account', videoId: 'video' } }, pendingOptions);
    expect(calls).toBe(2);
  });

  it.each(['queued', 'processing'])('continues Instagram polling for %s and preserves the scoped query', async status => {
    let calls = 0;
    const queries: unknown[] = [];
    const client = { posts: { getInstagramPostStatus: async (args: { query: unknown }) => {
      calls += 1;
      queries.push(args.query);
      return calls === 1 ? instagram(status) : instagram('published');
    } } };
    const result = await waitForInstagramPost(client, { query: { jobId: 'job', profileId: 'profile' } }, pendingOptions);
    expect(result.data.status).toBe('published');
    expect(queries).toEqual([{ jobId: 'job', profileId: 'profile' }, { jobId: 'job', profileId: 'profile' }]);
  });

  it.each(['published', 'failed', 'outcome_unknown'])('returns terminal Instagram status %s without retrying publication', async status => {
    let calls = 0;
    const client = { getInstagramPostStatus: async () => { calls += 1; return instagram(status); } };
    await expect(waitForInstagramPost(client, { query: { jobId: 'job' } }, pendingOptions)).resolves.toMatchObject({ data: { status } });
    expect(calls).toBe(1);
  });

  it('treats TikTok inbox delivery as terminal but not public publication', async () => {
    let calls = 0;
    const client = { posts: { getTikTokPostStatus: async () => { calls += 1; return tiktok('SEND_TO_USER_INBOX'); } } };
    const result = await waitForTikTokPost(client, { query: { accountId: 'account', publishId: 'publish' } }, pendingOptions);
    expect(result.data.status).toBe('SEND_TO_USER_INBOX');
    expect(result.data.publicPostIds).toEqual([]);
    expect(calls).toBe(1);
  });

  it.each([
    ['PUBLISH_COMPLETE', 'tiktok'], ['FAILED', 'tiktok'],
    ['READY', 'facebook'], ['ERROR', 'facebook'],
    ['published', 'youtube'], ['failed', 'youtube'],
  ])('returns every publishing terminal status %s without extra requests', async (status, platform) => {
    let calls = 0;
    const client = { posts: {
      getTikTokPostStatus: async () => { calls += 1; return tiktok(status); },
      getFacebookPostStatus: async () => { calls += 1; return facebook(status); },
      getYouTubeVideoStatus: async () => { calls += 1; return youtube(status); },
    } };
    if (platform === 'tiktok') await waitForTikTokPost(client, { query: { accountId: 'account', publishId: 'publish' } }, pendingOptions);
    if (platform === 'facebook') await waitForFacebookPost(client, { query: { accountId: 'account', publishId: 'publish' } }, pendingOptions);
    if (platform === 'youtube') await waitForYouTubeVideo(client, { query: { accountId: 'account', videoId: 'video' } }, pendingOptions);
    expect(calls).toBe(1);
  });

  it('rejects fabricated connection pending and unknown provider statuses', async () => {
    const connectionClient = { profiles: { getConnection: async () => connection('pending') } };
    const tiktokClient = { posts: { getTikTokPostStatus: async () => tiktok('UNKNOWN') } };
    await expect(waitForConnection(connectionClient, { path: { profileId: 'profile', connectionSessionId: 'session' } }, pendingOptions)).rejects.toBeInstanceOf(MalformedResponseError);
    await expect(waitForTikTokPost(tiktokClient, { query: { accountId: 'account', publishId: 'publish' } }, pendingOptions)).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it('validates polling timeout and interval boundaries before polling', async () => {
    let calls = 0;
    const client = { profiles: { getConnection: async () => { calls++; return connection('connected'); } } };
    const args = { path: { profileId: 'profile', connectionSessionId: 'session' } };
    await expect(waitForConnection(client, args, { timeoutMs: 2_147_483_648, intervalMs: 1 })).rejects.toThrow('no greater than 2147483647ms');
    await expect(waitForConnection(client, args, { timeoutMs: 1, intervalMs: 2_147_483_648 })).rejects.toThrow('no greater than 2147483647ms');
    expect(calls).toBe(0);
    await expect(waitForConnection(client, args, { timeoutMs: 2_147_483_647, intervalMs: 2_147_483_647 })).resolves.toMatchObject({ data: { status: 'connected' } });
    expect(calls).toBe(1);
  });

  it('propagates API errors without retrying', async () => {
    const error = new Error('provider failure');
    let calls = 0;
    const client = { posts: { getTikTokPostStatus: async () => { calls += 1; throw error; } } };
    await expect(waitForTikTokPost(client, { query: { accountId: 'account', publishId: 'publish' } }, pendingOptions)).rejects.toBe(error);
    expect(calls).toBe(1);
  });

  it('times out a hanging in-flight request and observes its late rejection', async () => {
    let rejectLate!: (error: Error) => void;
    const late = new Promise<ApiResponse<any>>((_resolve, reject) => { rejectLate = reject; });
    const client = { profiles: { getConnection: () => late } };
    const pending = waitForConnection(client, { path: { profileId: 'profile', connectionSessionId: 'session' } }, { timeoutMs: 5, intervalMs: 1 });
    await expect(pending).rejects.toBeInstanceOf(TimeoutError);
    rejectLate(new Error('late rejection observed by helper'));
    await new Promise(resolve => setTimeout(resolve, 1));
  });

  it('cancels before request, in-flight, and while waiting between polls', async () => {
    const before = new AbortController();
    before.abort();
    let beforeCalls = 0;
    await expect(waitForConnection({ profiles: { getConnection: async () => { beforeCalls += 1; return connection('connected'); } } }, { path: { profileId: 'profile', connectionSessionId: 'session' } }, { timeoutMs: 100, intervalMs: 1, signal: before.signal })).rejects.toBeInstanceOf(CancellationError);
    expect(beforeCalls).toBe(0);

    const inFlight = new AbortController();
    const hanging = new Promise<ApiResponse<any>>(() => undefined);
    const inFlightRequest = waitForConnection({ profiles: { getConnection: () => hanging } }, { path: { profileId: 'profile', connectionSessionId: 'session' } }, { timeoutMs: 100, intervalMs: 1, signal: inFlight.signal });
    inFlight.abort();
    await expect(inFlightRequest).rejects.toBeInstanceOf(CancellationError);

    const inWait = new AbortController();
    let calls = 0;
    const waiting = waitForConnection({ profiles: { getConnection: async () => { calls += 1; return connection('processing'); } } }, { path: { profileId: 'profile', connectionSessionId: 'session' } }, { timeoutMs: 1000, intervalMs: 100, signal: inWait.signal });
    await new Promise(resolve => setTimeout(resolve, 1));
    inWait.abort();
    await expect(waiting).rejects.toBeInstanceOf(CancellationError);
    expect(calls).toBe(1);
  });

  it('snapshots status scope before caller mutation', async () => {
    const query = { accountId: 'original', publishId: 'publish' };
    const seen: string[] = [];
    let calls = 0;
    const client = { posts: { getTikTokPostStatus: async (args: { query: typeof query }) => {
      seen.push(args.query.accountId); calls += 1;
      if (calls === 1) query.accountId = 'mutated';
      return calls === 1 ? tiktok('PROCESSING_UPLOAD') : tiktok('PUBLISH_COMPLETE');
    } } };
    await waitForTikTokPost(client, { query }, pendingOptions);
    expect(seen).toEqual(['original', 'original']);
  });
});

describe('comment iterators', () => {
  it.each(['tiktok', 'youtube'] as const)('stops on an omitted %s cursor and preserves the terminal page', async platform => {
    const data = commentPage({ platform });
    delete data.nextCursor;
    const terminal = response(data);
    let calls = 0;
    const client = { comments: { listComments: async () => { calls += 1; return terminal; } } };
    const pages = [];
    for await (const page of iterateCommentPages(client as any, { query: { platform, accountId: 'account', postId: 'post-1' } })) pages.push(page);
    expect(pages).toEqual([terminal]);
    expect(pages[0]).toBe(terminal);
    expect(calls).toBe(1);
    expect('nextCursor' in data).toBe(false);
  });

  it('pins authoritative first post, preserves scope, and does not mutate input', async () => {
    const query = { platform: 'tiktok' as const, accountId: 'account', profileId: 'profile' };
    const original = { ...query };
    const seen: unknown[] = [];
    const pages = [commentPage({ nextCursor: 'cursor-1' }), commentPage({ comments: [{ id: 'comment-2', mediaId: 'post-1', body: 'unchanged' }] })];
    const client = { comments: { listComments: async (args: { query: any }) => { const page = pages[seen.length] ?? pages[1]; seen.push({ ...args.query }); return response(page); } } };
    const yielded = [];
    for await (const page of iterateCommentPages(client as any, { query }, { maxPages: 3 })) yielded.push(page);
    expect(seen).toEqual([{ platform: 'tiktok', accountId: 'account', profileId: 'profile' }, { platform: 'tiktok', accountId: 'account', profileId: 'profile', postId: 'post-1', cursor: 'cursor-1' }]);
    expect(query).toEqual(original);
    expect(yielded[0]?.data.complete).toBe(false);
  });

  it('does not use complete as pagination termination, and stops repeated starting cursor', async () => {
    let calls = 0;
    const client = { comments: { listComments: async (args: { query: any }) => { calls += 1; return response(commentPage({ platform: 'youtube', complete: true, nextCursor: args.query.cursor === 'start' ? 'start' : 'next' })); } } };
    const pages = [];
    for await (const page of iterateCommentPages(client as any, { query: { platform: 'youtube', accountId: 'account', postId: 'post-1', cursor: 'start' } }, { maxPages: 5 })) pages.push(page);
    expect(pages).toHaveLength(1);
    expect(calls).toBe(1);
  });

  it('bounds pages and supports early consumer break without prefetch', async () => {
    let calls = 0;
    const client = { comments: { listComments: async () => { calls += 1; return response(commentPage({ nextCursor: `cursor-${calls}` })); } } };
    const pages = [];
    for await (const page of iterateCommentPages(client as any, { query: { platform: 'tiktok', accountId: 'account', postId: 'post-1' } }, { maxPages: 2 })) pages.push(page);
    expect(pages).toHaveLength(2);
    expect(calls).toBe(2);
    for await (const page of iterateCommentPages(client as any, { query: { platform: 'tiktok', accountId: 'account', postId: 'post-1' } }, { maxPages: 5 })) { void page; break; }
    expect(calls).toBe(3);
  });

  it('rejects unsupported platforms, cursor without post, missing post identity, malformed cursors/comments, and scope changes', async () => {
    const calls = { count: 0 };
    const client = { comments: { listComments: async () => { calls.count += 1; return response(commentPage({ postId: null, posts: [{ id: 'newest' }], nextCursor: 'next' })); } } };
    await expect(iterateCommentPages(client as any, { query: { platform: 'instagram' as any, accountId: 'account' } }).next()).rejects.toBeInstanceOf(Error);
    await expect(iterateCommentPages(client as any, { query: { platform: 'tiktok', accountId: 'account', cursor: 'cursor' } }).next()).rejects.toBeInstanceOf(MalformedResponseError);
    await expect(iterateCommentPages(client as any, { query: { platform: 'tiktok', accountId: 'account' } }).next()).rejects.toBeInstanceOf(MalformedResponseError);
    expect(calls.count).toBe(1);

    const malformedCursor = { comments: { listComments: async () => response(commentPage({ nextCursor: 42 })) } };
    await expect(iterateCommentPages(malformedCursor as any, { query: { platform: 'tiktok', accountId: 'account' } }).next()).rejects.toBeInstanceOf(MalformedResponseError);
    const malformedComment = { comments: { listComments: async () => response(commentPage({ comments: [{ body: 'missing id' }] })) } };
    await expect(iterateComments(malformedComment as any, { query: { platform: 'tiktok', accountId: 'account' } }).next()).rejects.toBeInstanceOf(MalformedResponseError);
    const mismatch = { comments: { listComments: async () => response(commentPage({ accountId: 'other' })) } };
    await expect(iterateCommentPages(mismatch as any, { query: { platform: 'tiktok', accountId: 'account' } }).next()).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it('validates positive finite page budgets', async () => {
    const client = { comments: { listComments: async () => response(commentPage()) } };
    await expect(iterateCommentPages(client as any, { query: { platform: 'tiktok', accountId: 'account' } }, { maxPages: 0 }).next()).rejects.toBeInstanceOf(Error);
    await expect(iterateCommentPages(client as any, { query: { platform: 'tiktok', accountId: 'account' } }, { maxPages: Number.POSITIVE_INFINITY }).next()).rejects.toBeInstanceOf(Error);
  });

  it.each(['tiktok', 'youtube'] as const)('validates %s iterator timeout boundaries before listComments', async platform => {
    let calls = 0;
    const client = { comments: { listComments: async () => { calls += 1; return response(commentPage({ platform })); } } };
    const args = { query: { platform, accountId: 'account' } };
    await expect(iterateCommentPages(client as any, args, { timeoutMs: 2_147_483_648 }).next()).rejects.toThrow('no greater than 2147483647ms');
    expect(calls).toBe(0);
    await expect(iterateCommentPages(client as any, args, { timeoutMs: 2_147_483_647 }).next()).resolves.toMatchObject({ value: { status: 200 } });
    expect(calls).toBe(1);
  });

  it('cancels and times out comment requests while preserving late outcomes', async () => {
    const controller = new AbortController();
    const client = { comments: { listComments: () => new Promise<ApiResponse<any>>(() => undefined) } };
    const request = iterateCommentPages(client as any, { query: { platform: 'youtube', accountId: 'account' } }, { timeoutMs: 100, signal: controller.signal }).next();
    controller.abort();
    await expect(request).rejects.toBeInstanceOf(CancellationError);
    await expect(iterateCommentPages(client as any, { query: { platform: 'youtube', accountId: 'account' } }, { timeoutMs: 5 }).next()).rejects.toBeInstanceOf(TimeoutError);
  });
});
