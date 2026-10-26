import { readFileSync } from 'node:fs';
import * as Ajv2020Module from '@redocly/ajv/dist/2020.js';
import type { ApiResponse, RequestOptions } from '../src/index.js';
import { Adeli } from '../src/index.js';

/**
 * Wire fixtures mirror the approved public API response schemas and handler
 * contract matrix in adeli/apps/web/lib/public-api/response-schemas.ts and
 * adeli/apps/web/test/public-api-handler-contract.ts. They are intentionally
 * not derived from SDK metadata; the test proves the SDK returns these bytes.
 */
const id = '00000000-0000-0000-0000-000000000001';
const baseURL = 'http://localhost:3210';
const key = 'wire-key';
const post = { id: 'post-1', platform: 'x', accountId: id, profileId: id, providerId: 'provider-1', caption: null, media: [{ type: 'image', url: null, thumbnailUrl: null }], permalink: null, engagement: { likes: 1, comments: null, shares: 0, views: null, reach: null }, publishedAt: null };
const account = { id, accountId: id, profileId: id, platform: 'x', providerId: null, displayName: null, displayIdentifier: '@wire', connectionStatus: 'connected', grantedPermissions: ['read'], recommendedPermissions: [{ code: 'inbox', label: 'Inbox' }], missingRecommendedPermissions: [], capabilities: { analytics: false, inbox: true }, capabilityRequirements: {}, reconnect: { action: 'restart_oauth', method: 'POST', href: null, provider: 'x' } };
const profile = { id, name: 'Default', externalId: null, metadata: {}, isDefault: true, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z' };
const comment = { id: 'comment-1', mediaId: 'media-1', parentId: null, authorName: 'Author', authorFullName: null, authorHandle: '@author', avatarUrl: null, profileUrl: null, body: 'hello', likeCount: 0, isCreator: false, isHidden: false, createdAt: '2025-01-01T00:00:00.000Z', liked: false, replyCount: 0, deletable: true };
const message = { id: 'message-1', providerId: null, platform: 'facebook', accountId: id, profileId: id, direction: 'outbound', type: 'text', recipient: 'recipient', sender: null, body: 'hello', status: 'sent', occurredAt: '2025-01-01T00:00:00.000Z', createdAt: '2025-01-01T00:00:00.000Z' };
const errorRecord = { platform: 'x', accountId: id, code: 'permission_required', message: 'permission required', details: { missing: ['read'] } };

type ContractDocument = { paths: Record<string, Record<string, { operationId?: string; responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> }>> };
const contract = JSON.parse(readFileSync('openapi/adeli.openapi.json', 'utf8')) as ContractDocument;
type ValidationFunction = ((value: unknown) => boolean) & { errors?: unknown[] | null };
type JsonValidator = {
  addSchema(schema: unknown, id: string): void;
  compile(schema: unknown): ValidationFunction;
  errorsText(errors?: unknown[] | null): string;
};
type JsonValidatorConstructor = new (options?: Record<string, unknown>) => JsonValidator;
const validator = new (Ajv2020Module.default as unknown as JsonValidatorConstructor)({ strict: false, validateFormats: false });
validator.addSchema(contract, 'adeli-pinned-contract');
function pointerPart(value: string): string { return value.replaceAll('~', '~0').replaceAll('/', '~1'); }
function successStatuses(operationId: string): string[] {
  for (const methods of Object.values(contract.paths)) for (const operation of Object.values(methods)) {
    if (operation.operationId === operationId) return Object.keys(operation.responses ?? {}).filter((status) => /^2\d\d$/.test(status));
  }
  throw new Error(`missing OpenAPI operation ${operationId}`);
}
function declaredSuccessPairs(): Set<string> {
  const pairs = new Set<string>();
  for (const methods of Object.values(contract.paths)) for (const operation of Object.values(methods)) {
    for (const status of Object.keys(operation.responses ?? {}).filter((candidate) => /^2\d\d$/.test(candidate))) pairs.add(`${operation.operationId}:${status}`);
  }
  return pairs;
}
function validateSuccess(operationId: string, status: string, value: unknown): void {
  if (status === '204') { expect(value, `${operationId} ${status}`).toBeUndefined(); return; }
  let path: string | undefined;
  let method: string | undefined;
  for (const [candidatePath, methods] of Object.entries(contract.paths)) for (const [candidateMethod, operation] of Object.entries(methods)) {
    if (operation.operationId === operationId) { path = candidatePath; method = candidateMethod; }
  }
  if (path === undefined || method === undefined) throw new Error(`missing OpenAPI operation ${operationId}`);
  const schemaRef = `adeli-pinned-contract#/paths/${pointerPart(path)}/${method}/responses/${status}/content/application~1json/schema`;
  const validate = validator.compile({ $ref: schemaRef });
  expect(validate(value), `${operationId} ${status}: ${validator.errorsText(validate.errors)}`).toBe(true);
}

function wireResponse(operationId: string, _status?: string): unknown {
  switch (operationId) {
    case 'getMe': return { message: 'ok', you: { name: null, organization: 'Org', profile }, apiKey: { label: null, prefix: 'ade_', createdAt: profile.createdAt }, accountsConnected: [{ accountId: id, platform: 'x', username: null }], docs: 'https://docs.example' };
    case 'listProfiles': return { profiles: [profile] };
    case 'createProfile': case 'getProfile': case 'updateProfile': return profile;
    case 'deleteProfile': return { id, deleted: true };
    case 'startConnection': case 'getConnection': return { id: 'connection-1', profileId: id, platform: 'youtube', status: 'pending_authorization', accountId: null, expiresAt: '2025-01-02T00:00:00.000Z', completedAt: null, error: null, authMethod: 'facebook_login', authUrl: 'https://provider.example/auth' };
    case 'listAccounts': case 'listProfileAccounts': return { status: 'partial', accounts: [account], errors: [errorRecord] };
    case 'getAccount': case 'updateAccount': return account;
    case 'disconnectAccount': return { id, disconnected: true, revocationFailed: false };
    case 'refreshAccounts': return { status: 'partial', accounts: [{ id, accountId: id, profileId: id, platform: 'youtube', refreshed: true, expiresAt: '2025-01-02T00:00:00.000Z' }], errors: [errorRecord] };
    case 'listPosts': return { status: 'partial', posts: [post], errors: [errorRecord] };
    case 'createMediaUploads': return { uploads: [{ clientId: '0', uploadId: 'staged', method: 'PUT', url: 'https://s3.example/0', headers: { 'content-type': 'video/mp4' }, expiresAt: '2026-10-26T12:00:00.000Z' }] };
    case 'createPost':
      if (_status === '201') return post;
      if (_status === '202') return { id: 'upload-1', platform: 'youtube', accountId: id, profileId: id, publishId: 'publish-1', videoId: 'video-1', permalink: 'https://youtube.example/video-1', status: 'ACCEPTED', requestedPrivacy: 'private', appliedPrivacy: 'private', privacyRestricted: false, publishAt: null, thumbnail: null, statusUrl: '/api/v1/posts/youtube/status', warnings: [] };
      return { id: 'thread-1', status: 'partial', platform: 'x', accountId: id, profileId: id, providerId: 'provider-1', permalink: 'https://social.example/post-1', posts: [{ index: 0, status: 'published', providerId: 'provider-1', url: 'https://social.example/post-1' }] };
    case 'uploadYouTubeVideo': return { id: 'upload-1', platform: 'youtube', accountId: id, profileId: id, publishId: 'publish-1', videoId: 'video-1', permalink: 'https://youtube.example/video-1', status: 'ACCEPTED', requestedPrivacy: 'private', appliedPrivacy: 'private', privacyRestricted: false, publishAt: null, thumbnail: null, statusUrl: '/api/v1/posts/youtube/status', warnings: [] };
    case 'deleteXPost': return { id: 'post-1', accountId: id, providerId: 'provider-1', deleted: true, platform: 'x' };
    case 'deleteBlueskyPost': return { id: 'post-1', accountId: id, providerId: 'provider-1', deleted: true, platform: 'bluesky' };
    case 'getFacebookPostStatus': return { platform: 'facebook', accountId: id, profileId: id, publishId: 'publish-1', status: 'READY', phase: null, permalink: null, failureReason: null };
    case 'getTikTokPostStatus': return { platform: 'tiktok', accountId: id, profileId: id, publishId: 'publish-1', status: 'processing', publicPostId: null, publicPostIds: [], failureReason: null, publiclyAvailable: null, source: 'provider' };
    case 'getTikTokCreatorInfo': return { platform: 'tiktok', accountId: id, profileId: id, creator: { nickname: null, privacyLevelOptions: ['PUBLIC_TO_EVERYONE'], commentDisabled: false, duetDisabled: false, stitchDisabled: false, maxVideoPostDurationSec: 60 } };
    case 'getYouTubeVideoStatus': return { platform: 'youtube', accountId: id, profileId: id, videoId: 'video-1', status: 'processing', uploadStatus: null, processingStatus: null, failureReason: null, privacyStatus: null, publishAt: null, permalink: null };
    case 'listComments': return { platform: 'youtube', accountId: id, profileId: id, postId: null, posts: [{ id: 'post-1', caption: null, thumbnailUrl: null, permalink: null, publishedAt: null, commentsCount: null, editable: false }], comments: [comment], nextCursor: null, complete: false, syncedAt: null };
    case 'createComment': return { platform: 'youtube', accountId: id, profileId: id, comment };
    case 'updateComment': return { platform: 'youtube', accountId: id, profileId: id, comment: { id: 'comment-1', hidden: false, liked: true } };
    case 'listMessages': return { status: 'partial', messages: [message], errors: [errorRecord] };
    case 'sendMessage': return message;
    case 'getInstagramAccountInsights': return { platform: 'instagram', accountId: id, profileId: id, insights: [{ name: 'reach', title: 'Reach', period: 'day', total_value: { value: 0 }, values: [{ value: 0, end_time: '2025-01-01T00:00:00.000Z' }] }], fetchedAt: profile.updatedAt };
    case 'getFacebookPageMetrics': return { platform: 'facebook', accountId: id, profileId: id, page: { id: 'page-1', name: null, username: null, category: null, link: null }, metrics: { followers: null, fans: 0, recentPosts: 0, recentPostLikes: 0, recentPostComments: 0, recentPostShares: 0 }, insights: null, insightsUnavailable: 'permission_missing', fetchedAt: profile.updatedAt };
    case 'getTikTokAccountAnalytics': return { platform: 'tiktok', accountId: id, profileId: id, profile: { openId: 'open', username: null, displayName: null, avatarUrl: null, profileDeepLink: null, bioDescription: null, isVerified: null, isBusinessAccount: null }, analytics: { followers: 0, following: null, likes: null, videos: null }, fetchedAt: profile.updatedAt };
    case 'getTikTokAccountInsights': return { platform: 'tiktok', accountId: id, profileId: id, isBusinessAccount: null, startDate: '2025-01-01', endDate: '2025-01-02', daily: [], audience: { ages: [], genders: [], countries: [], cities: [] }, fetchedAt: profile.updatedAt };
    case 'getTikTokVideoInsights': return { platform: 'tiktok', accountId: id, profileId: id, videos: [], fetchedAt: profile.updatedAt };
    case 'getYouTubeChannelInsights': return { platform: 'youtube', accountId: id, profileId: id, channel: { channelId: 'channel', title: 'Channel', handle: null, avatarUrl: null, subscribers: null, views: null, videos: null }, insights: { startDate: '2025-01-01', endDate: '2025-01-02', daily: [], topVideos: [], audience: { ageGender: [], countries: [] } }, fetchedAt: profile.updatedAt };
    case 'getYouTubeVideoInsights': return { platform: 'youtube', accountId: id, profileId: id, insights: { startDate: '2025-01-01', endDate: '2025-01-02', videos: [] }, fetchedAt: profile.updatedAt };
    case 'listAdBusinesses': return { platform: 'facebook', accountId: id, profileId: id, businesses: [{ id: 'business-1', name: 'Business' }] };
    case 'listAdAccounts': return { platform: 'facebook', accountId: id, profileId: id, adAccounts: [], fetchedAt: profile.updatedAt };
    case 'createAdAccount': return { adAccount: { id: 'act_1' }, replayed: false };
    case 'getAdAccount': case 'updateAdAccount': return { platform: 'facebook', accountId: id, profileId: id, adAccount: { id: 'act_1', accountId: id, name: 'Ads', currency: null, timezoneName: null, accountStatus: null, minDailyBudget: null, businessId: null, businessName: null }, details: { id: 'act_1', currency: null, accountStatus: null, disableReason: null, spendCap: 0, amountSpent: 0, hasPaymentMethod: false } };
    case 'getAdTree': return { platform: 'facebook', accountId: id, profileId: id, adAccount: { id: 'act_1', accountId: id, name: 'Ads', currency: null, timezoneName: null, accountStatus: null, minDailyBudget: null, businessId: null, businessName: null }, campaigns: [], range: { since: '2025-01-01', until: '2025-01-02' }, fetchedAt: profile.updatedAt };
    case 'getAdInsights': return { platform: 'facebook', accountId: id, profileId: id, adAccountId: 'act_1', objectId: '1', points: [{ date: '2025-01-01', spend: 0, impressions: 0, clicks: 0, conversions: null }], range: { since: '2025-01-01', until: '2025-01-02' }, fetchedAt: profile.updatedAt };
    case 'listAdLeads': return { platform: 'facebook', accountId: id, profileId: id, forms: [{ id: 'form-1', name: 'Form', status: null, leadsCount: null, createdAt: null }], fetchedAt: profile.updatedAt };
    case 'createCampaign': return { campaign: { id, profileId: id, facebookConnectionId: null, adAccountId: 'act_1', pageId: 'page-1', pagePostId: '1', idempotencyKey: 'campaign-key', campaignId: null, adSetId: null, creativeId: null, adId: null, status: 'pending', failureReason: null, createdAt: profile.createdAt, updatedAt: profile.updatedAt }, objects: { campaignId: 'campaign', adSetId: 'set', creativeId: 'creative', adId: 'ad' }, preview: null, replayed: false };
    case 'deleteCampaign': return undefined;
    case 'setAdStatus': return { platform: 'facebook', accountId: id, objectId: '1', status: 'PAUSED' };
    case 'getXUsage': return { from: '2025-01-01T00:00:00.000Z', to: '2025-02-01T00:00:00.000Z', ratesAsOf: '2025-01-01', totalCostMicros: 0, operations: [{ operation: 'list_posts', resourceType: 'post', resourceCount: 1, costMicros: 0 }] };
    default: throw new Error(`fixture missing for ${operationId}`);
  }
}

type ExpectedBody = undefined | Record<string, unknown> | ((request: Request) => Promise<void>);
type WireCase = { id: string; call: (options: RequestOptions) => Promise<ApiResponse<unknown>>; method: string; path: string; query?: string; body?: ExpectedBody; status: number; response: unknown; idempotencyKey?: string };

function jsonBody(body: Record<string, unknown>): ExpectedBody { return body; }
function requireRequest(value: Request | undefined, id: string): Request { if (value === undefined) throw new Error(`${id}: fetch was not called`); return value; }
// Request expectations are deliberately written independently of operations metadata; the registry is only a coverage allow-list.
test('all 49 registered operations preserve exact wire requests and response envelopes', async () => {
  let currentFixture: WireCase | undefined;
  let returnUnauthorized = false;
  const unauthorizedDetails = { reason: 'wire-contract', nested: { preserved: true } };
  const state: { request?: Request } = {};
  const client = new Adeli({ apiKey: key, baseURL, fetch: async (input, init) => {
    state.request = new Request(input, init);
    const fixture = currentFixture!;
    if (returnUnauthorized) return new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'Unauthorized', details: unauthorizedDetails } }), { status: 401, headers: { 'content-type': 'application/json', 'x-error-fixture': fixture.id } });
    return fixture.status === 204 ? new Response(null, { status: 204, headers: { 'x-fixture': fixture.id } }) : new Response(JSON.stringify(fixture.response), { status: fixture.status, headers: { 'content-type': 'application/json', 'x-fixture': fixture.id } });
  } });
  const cases: WireCase[] = [
    { id: 'getMe', call: (o) => client.getMe({ query: { profileId: id } }, o), method: 'GET', path: '/api/v1/me', query: `profileId=${id}`, status: 200, response: wireResponse('getMe') },
    { id: 'listProfiles', call: (o) => client.profiles.listProfiles({}, o), method: 'GET', path: '/api/v1/profiles', status: 200, response: wireResponse('listProfiles') },
    { id: 'createProfile', call: (o) => client.profiles.createProfile({ body: { name: 'p', externalId: null, metadata: {} } }, o), method: 'POST', path: '/api/v1/profiles', body: jsonBody({ name: 'p', externalId: null, metadata: {} }), status: 201, response: wireResponse('createProfile') },
    { id: 'getProfile', call: (o) => client.profiles.getProfile({ path: { profileId: 'profile/a' } }, o), method: 'GET', path: '/api/v1/profiles/profile%2Fa', status: 200, response: wireResponse('getProfile') },
    { id: 'updateProfile', call: (o) => client.profiles.updateProfile({ path: { profileId: id }, body: { name: 'p', externalId: null, metadata: {} } }, o), method: 'PUT', path: `/api/v1/profiles/${id}`, body: jsonBody({ name: 'p', externalId: null, metadata: {} }), status: 200, response: wireResponse('updateProfile') },
    { id: 'deleteProfile', call: (o) => client.profiles.deleteProfile({ path: { profileId: id } }, o), method: 'DELETE', path: `/api/v1/profiles/${id}`, status: 200, response: wireResponse('deleteProfile') },
    { id: 'startConnection', call: (o) => client.profiles.startConnection({ path: { profileId: id }, body: { platform: 'youtube', redirectUrl: 'https://app.example/callback' } }, o), method: 'POST', path: `/api/v1/profiles/${id}/connect`, body: jsonBody({ platform: 'youtube', redirectUrl: 'https://app.example/callback' }), status: 201, response: wireResponse('startConnection') },
    { id: 'getConnection', call: (o) => client.profiles.getConnection({ path: { profileId: id, connectionSessionId: 'session/a' } }, o), method: 'GET', path: `/api/v1/profiles/${id}/connect/session%2Fa`, status: 200, response: wireResponse('getConnection') },
    { id: 'listAccounts', call: (o) => client.accounts.listAccounts({ query: { platform: 'x', accountId: id, profileId: id } }, o), method: 'GET', path: '/api/v1/accounts', query: `platform=x&accountId=${id}&profileId=${id}`, status: 207, response: wireResponse('listAccounts') },
    { id: 'listProfileAccounts', call: (o) => client.accounts.listProfileAccounts({ path: { profileId: id } }, o), method: 'GET', path: `/api/v1/profiles/${id}/accounts`, status: 200, response: wireResponse('listProfileAccounts') },
    { id: 'getAccount', call: (o) => client.accounts.getAccount({ path: { profileId: id, accountId: 'account/a' } }, o), method: 'GET', path: `/api/v1/profiles/${id}/accounts/account%2Fa`, status: 200, response: wireResponse('getAccount') },
    { id: 'updateAccount', call: (o) => client.accounts.updateAccount({ path: { profileId: id, accountId: id }, body: { xCapabilities: { analytics: false, inbox: true } } }, o), method: 'PATCH', path: `/api/v1/profiles/${id}/accounts/${id}`, body: jsonBody({ xCapabilities: { analytics: false, inbox: true } }), status: 200, response: wireResponse('updateAccount') },
    { id: 'disconnectAccount', call: (o) => client.accounts.disconnectAccount({ path: { profileId: id, accountId: id } }, o), method: 'DELETE', path: `/api/v1/profiles/${id}/accounts/${id}`, status: 200, response: wireResponse('disconnectAccount') },
    { id: 'refreshAccounts', call: (o) => client.accounts.refreshAccounts({ path: { profileId: id } }, o), method: 'POST', path: `/api/v1/profiles/${id}/accounts/refresh`, status: 207, response: wireResponse('refreshAccounts') },
    { id: 'listPosts', call: (o) => client.posts.listPosts({ query: { platform: 'x', accountId: id, profileId: id } }, o), method: 'GET', path: '/api/v1/posts', query: `platform=x&accountId=${id}&profileId=${id}`, status: 207, response: wireResponse('listPosts') },
    { id: 'createMediaUploads', call: (o) => client.posts.createMediaUploads({ body: { profileId: id, platform: 'youtube', files: [{ clientId: '0', purpose: 'post_media', contentType: 'video/mp4', size: 1 }] } }, o), method: 'POST', path: '/api/v1/media/uploads', body: jsonBody({ profileId: id, platform: 'youtube', files: [{ clientId: '0', purpose: 'post_media', contentType: 'video/mp4', size: 1 }] }), status: 201, response: wireResponse('createMediaUploads') },
    { id: 'createPost', call: (o) => client.posts.createPost({ body: { platform: 'x', accountId: id, text: 'hello', media: [{ url: 'https://media.example/a.jpg' }] } }, o), method: 'POST', path: '/api/v1/posts', body: jsonBody({ platform: 'x', accountId: id, text: 'hello', media: [{ url: 'https://media.example/a.jpg' }] }), status: 207, response: wireResponse('createPost') },
    { id: 'uploadYouTubeVideo', call: (o) => client.posts.uploadYouTubeVideo({ body: { platform: 'youtube', accountId: id, video: { upload_id: 'staged' }, title: 'v', privacy_status: 'private', made_for_kids: false } }, o), method: 'POST', path: '/api/v1/posts/youtube', body: jsonBody({ platform: 'youtube', accountId: id, video: { upload_id: 'staged' }, title: 'v', privacy_status: 'private', made_for_kids: false }), status: 202, response: wireResponse('uploadYouTubeVideo') },
    { id: 'deleteXPost', call: (o) => client.posts.deleteXPost({ path: { postId: 'post/a' }, query: { accountId: id, profileId: id } }, o), method: 'DELETE', path: '/api/v1/posts/x/post%2Fa', query: `accountId=${id}&profileId=${id}`, status: 200, response: wireResponse('deleteXPost') },
    { id: 'deleteBlueskyPost', call: (o) => client.posts.deleteBlueskyPost({ path: { postId: id }, query: { accountId: id } }, o), method: 'DELETE', path: `/api/v1/posts/bluesky/${id}`, query: `accountId=${id}`, status: 200, response: wireResponse('deleteBlueskyPost') },
    { id: 'getFacebookPostStatus', call: (o) => client.posts.getFacebookPostStatus({ query: { accountId: id, profileId: id, publishId: 'publish' } }, o), method: 'GET', path: '/api/v1/posts/facebook/status', query: `accountId=${id}&profileId=${id}&publishId=publish`, status: 200, response: wireResponse('getFacebookPostStatus') },
    { id: 'getTikTokPostStatus', call: (o) => client.posts.getTikTokPostStatus({ query: { accountId: id, publishId: 'publish' } }, o), method: 'GET', path: '/api/v1/posts/tiktok/status', query: `accountId=${id}&publishId=publish`, status: 200, response: wireResponse('getTikTokPostStatus') },
    { id: 'getTikTokCreatorInfo', call: (o) => client.posts.getTikTokCreatorInfo({ query: { accountId: id } }, o), method: 'GET', path: '/api/v1/posts/tiktok/creator-info', query: `accountId=${id}`, status: 200, response: wireResponse('getTikTokCreatorInfo') },
    { id: 'getYouTubeVideoStatus', call: (o) => client.posts.getYouTubeVideoStatus({ query: { accountId: id, videoId: 'video' } }, o), method: 'GET', path: '/api/v1/posts/youtube/status', query: `accountId=${id}&videoId=video`, status: 200, response: wireResponse('getYouTubeVideoStatus') },
    { id: 'listComments', call: (o) => client.comments.listComments({ query: { platform: 'youtube', accountId: id, profileId: id, postId: id, cursor: 'next' } }, o), method: 'GET', path: '/api/v1/comments', query: `platform=youtube&accountId=${id}&profileId=${id}&postId=${id}&cursor=next`, status: 200, response: wireResponse('listComments') },
    { id: 'createComment', call: (o) => client.comments.createComment({ body: { platform: 'youtube', accountId: id, profileId: id, postId: id, message: 'hello' } }, o), method: 'POST', path: '/api/v1/comments', body: jsonBody({ platform: 'youtube', accountId: id, profileId: id, postId: id, message: 'hello' }), status: 201, response: wireResponse('createComment') },
    { id: 'updateComment', call: (o) => client.comments.updateComment({ path: { commentId: 'comment/a' }, body: { platform: 'youtube', accountId: id, profileId: id, liked: false } }, o), method: 'PATCH', path: '/api/v1/comments/comment%2Fa', body: jsonBody({ platform: 'youtube', accountId: id, profileId: id, liked: false }), status: 200, response: wireResponse('updateComment') },
    { id: 'deleteComment', call: (o) => client.comments.deleteComment({ path: { commentId: id }, query: { platform: 'youtube', accountId: id, profileId: id, banAuthor: 'false' } }, o), method: 'DELETE', path: `/api/v1/comments/${id}`, query: `platform=youtube&accountId=${id}&profileId=${id}&banAuthor=false`, status: 204, response: undefined },
    { id: 'listMessages', call: (o) => client.messages.listMessages({ query: { platform: 'facebook', accountId: id, profileId: id } }, o), method: 'GET', path: '/api/v1/messages', query: `platform=facebook&accountId=${id}&profileId=${id}`, status: 207, response: wireResponse('listMessages') },
    { id: 'sendMessage', call: (o) => client.messages.sendMessage({ body: { platform: 'facebook', accountId: id, profileId: id, recipient: 'r', text: 'hello' } }, o), method: 'POST', path: '/api/v1/messages', body: jsonBody({ platform: 'facebook', accountId: id, profileId: id, recipient: 'r', text: 'hello' }), status: 201, response: wireResponse('sendMessage') },
    { id: 'getInstagramAccountInsights', call: (o) => client.analytics.getInstagramAccountInsights({ query: { accountId: id, profileId: id } }, o), method: 'GET', path: '/api/v1/analytics/instagram/account-insights', query: `accountId=${id}&profileId=${id}`, status: 200, response: wireResponse('getInstagramAccountInsights') },
    { id: 'getFacebookPageMetrics', call: (o) => client.analytics.getFacebookPageMetrics({ query: { accountId: id, profileId: id } }, o), method: 'GET', path: '/api/v1/analytics/facebook/page-metrics', query: `accountId=${id}&profileId=${id}`, status: 200, response: wireResponse('getFacebookPageMetrics') },
    { id: 'getTikTokAccountAnalytics', call: (o) => client.analytics.getTikTokAccountAnalytics({ query: { accountId: id, profileId: id } }, o), method: 'GET', path: '/api/v1/analytics/tiktok/account-analytics', query: `accountId=${id}&profileId=${id}`, status: 200, response: wireResponse('getTikTokAccountAnalytics') },
    { id: 'getTikTokAccountInsights', call: (o) => client.analytics.getTikTokAccountInsights({ query: { accountId: id, profileId: id, startDate: '2025-01-01', endDate: '2025-01-02' } }, o), method: 'GET', path: '/api/v1/analytics/tiktok/account-insights', query: `accountId=${id}&profileId=${id}&startDate=2025-01-01&endDate=2025-01-02`, status: 200, response: wireResponse('getTikTokAccountInsights') },
    { id: 'getTikTokVideoInsights', call: (o) => client.analytics.getTikTokVideoInsights({ query: { accountId: id, profileId: id, videoIds: 'v1' } }, o), method: 'GET', path: '/api/v1/analytics/tiktok/video-insights', query: `accountId=${id}&profileId=${id}&videoIds=v1`, status: 200, response: wireResponse('getTikTokVideoInsights') },
    { id: 'getYouTubeChannelInsights', call: (o) => client.analytics.getYouTubeChannelInsights({ query: { accountId: id, profileId: id, startDate: '2025-01-01', endDate: '2025-01-02' } }, o), method: 'GET', path: '/api/v1/analytics/youtube/channel-insights', query: `accountId=${id}&profileId=${id}&startDate=2025-01-01&endDate=2025-01-02`, status: 200, response: wireResponse('getYouTubeChannelInsights') },
    { id: 'getYouTubeVideoInsights', call: (o) => client.analytics.getYouTubeVideoInsights({ query: { accountId: id, profileId: id, videoIds: 'v1' } }, o), method: 'GET', path: '/api/v1/analytics/youtube/video-insights', query: `accountId=${id}&profileId=${id}&videoIds=v1`, status: 200, response: wireResponse('getYouTubeVideoInsights') },
    { id: 'listAdBusinesses', call: (o) => client.ads.listAdBusinesses({ query: { accountId: id, profileId: id } }, o), method: 'GET', path: '/api/v1/ads/businesses', query: `accountId=${id}&profileId=${id}`, status: 200, response: wireResponse('listAdBusinesses') },
    { id: 'listAdAccounts', call: (o) => client.ads.listAdAccounts({ query: { accountId: id, profileId: id, refresh: 'true' } }, o), method: 'GET', path: '/api/v1/ads/accounts', query: `accountId=${id}&profileId=${id}&refresh=true`, status: 200, response: wireResponse('listAdAccounts') },
    { id: 'createAdAccount', call: (o) => client.ads.createAdAccount({ query: { accountId: id, profileId: id }, body: { businessId: 'business', name: 'Ads', timezone: 'UTC' } }, { ...o, idempotencyKey: 'ad-key' }), method: 'POST', path: '/api/v1/ads/accounts', query: `accountId=${id}&profileId=${id}`, body: jsonBody({ businessId: 'business', name: 'Ads', timezone: 'UTC' }), status: 201, response: wireResponse('createAdAccount'), idempotencyKey: 'ad-key' },
    { id: 'getAdAccount', call: (o) => client.ads.getAdAccount({ path: { adAccountId: 'act/a' }, query: { accountId: id, profileId: id } }, o), method: 'GET', path: '/api/v1/ads/accounts/act%2Fa', query: `accountId=${id}&profileId=${id}`, status: 200, response: wireResponse('getAdAccount') },
    { id: 'updateAdAccount', call: (o) => client.ads.updateAdAccount({ path: { adAccountId: 'act/a' }, query: { accountId: id, profileId: id }, body: { name: 'Ads', spendCap: 0 } }, o), method: 'PATCH', path: '/api/v1/ads/accounts/act%2Fa', query: `accountId=${id}&profileId=${id}`, body: jsonBody({ name: 'Ads', spendCap: 0 }), status: 200, response: wireResponse('updateAdAccount') },
    { id: 'getAdTree', call: (o) => client.ads.getAdTree({ query: { accountId: id, profileId: id, adAccountId: 'act_1', since: '2025-01-01', until: '2025-01-02' } }, o), method: 'GET', path: '/api/v1/ads/tree', query: `accountId=${id}&profileId=${id}&adAccountId=act_1&since=2025-01-01&until=2025-01-02`, status: 200, response: wireResponse('getAdTree') },
    { id: 'getAdInsights', call: (o) => client.ads.getAdInsights({ query: { accountId: id, profileId: id, adAccountId: 'act_1', objectId: '1', since: '2025-01-01', until: '2025-01-02' } }, o), method: 'GET', path: '/api/v1/ads/insights', query: `accountId=${id}&profileId=${id}&adAccountId=act_1&objectId=1&since=2025-01-01&until=2025-01-02`, status: 200, response: wireResponse('getAdInsights') },
    { id: 'listAdLeads', call: (o) => client.ads.listAdLeads({ query: { accountId: id, profileId: id, formId: 'form-1' } }, o), method: 'GET', path: '/api/v1/ads/leads', query: `accountId=${id}&profileId=${id}&formId=form-1`, status: 200, response: wireResponse('listAdLeads') },
    { id: 'createCampaign', call: (o) => client.ads.createCampaign({ query: { accountId: id, profileId: id }, body: { adAccountId: 'act_1', pagePostId: '1', dailyBudget: 0, startDate: '2025-01-01', endDate: '2025-01-02', campaignName: 'Campaign' } }, { ...o, idempotencyKey: 'campaign-key' }), method: 'POST', path: '/api/v1/ads/campaigns', query: `accountId=${id}&profileId=${id}`, body: jsonBody({ adAccountId: 'act_1', pagePostId: '1', dailyBudget: 0, startDate: '2025-01-01', endDate: '2025-01-02', campaignName: 'Campaign' }), status: 200, response: wireResponse('createCampaign'), idempotencyKey: 'campaign-key' },
    { id: 'deleteCampaign', call: (o) => client.ads.deleteCampaign({ path: { campaignId: 'campaign/a' }, query: { accountId: id, profileId: id, adAccountId: 'act_1' } }, o), method: 'DELETE', path: '/api/v1/ads/campaigns/campaign%2Fa', query: `accountId=${id}&profileId=${id}&adAccountId=act_1`, status: 204, response: wireResponse('deleteCampaign') },
    { id: 'setAdStatus', call: (o) => client.ads.setAdStatus({ query: { accountId: id, profileId: id }, body: { adAccountId: 'act_1', objectId: '1', status: 'PAUSED' } }, o), method: 'PUT', path: '/api/v1/ads/status', query: `accountId=${id}&profileId=${id}`, body: jsonBody({ adAccountId: 'act_1', objectId: '1', status: 'PAUSED' }), status: 200, response: wireResponse('setAdStatus') },
    { id: 'getXUsage', call: (o) => client.usage.getXUsage({}, o), method: 'GET', path: '/api/v1/usage/x', status: 200, response: wireResponse('getXUsage') },
  ];

  const { operations } = await import('../src/operations.js');
  expect(new Set(cases.map((item) => item.id))).toEqual(new Set(Object.keys(operations)));
  expect(cases).toHaveLength(Object.keys(operations).length);
  expect(declaredSuccessPairs()).toHaveLength(58);
  for (const fixture of cases) {
    for (const status of successStatuses(fixture.id)) {
      delete state.request;
      const successFixture = { ...fixture, status: Number(status), response: status === '204' ? undefined : wireResponse(fixture.id, status) };
      currentFixture = successFixture;
      const controller = new AbortController();
      let result: ApiResponse<unknown>;
      try { result = await fixture.call({ signal: controller.signal, timeoutMs: 12_345 }); }
      catch (error) { throw new Error(`${fixture.id} ${status}: ${error instanceof Error ? error.message : String(error)}`); }
      const request = requireRequest(state.request, fixture.id);
      expect(request.method, fixture.id).toBe(fixture.method);
      expect(`${new URL(request.url).pathname}`, fixture.id).toBe(fixture.path);
      expect(new URL(request.url).search, fixture.id).toBe(fixture.query ? `?${fixture.query}` : '');
      expect(request.headers.get('authorization'), fixture.id).toBe(`Bearer ${key}`);
      expect(request.headers.get('accept'), fixture.id).toBe('application/json');
      expect(request.signal.aborted, fixture.id).toBe(false);
      if (fixture.idempotencyKey) expect(request.headers.get('idempotency-key')).toBe(fixture.idempotencyKey);
      if (fixture.body === undefined) expect(request.body, fixture.id).toBeNull();
      else if (typeof fixture.body === 'function') await fixture.body(request);
      else expect(JSON.parse(await request.clone().text()), fixture.id).toEqual(fixture.body);
      expect(result.status, fixture.id).toBe(successFixture.status);
      expect(result.data, fixture.id).toEqual(successFixture.response);
      expect(result.headers.get('x-fixture'), fixture.id).toBe(fixture.id);
      validateSuccess(fixture.id, status, result.data);
    }
  }

  returnUnauthorized = true;
  for (const fixture of cases) {
    delete state.request;
    currentFixture = fixture;
    const error = await fixture.call({ signal: new AbortController().signal, timeoutMs: 12_345 }).then(
      () => { throw new Error(`${fixture.id}: method swallowed the documented 401 response`); },
      reason => reason,
    );
    expect(requireRequest(state.request, fixture.id).method, fixture.id).toBe(fixture.method);
    expect(error, fixture.id).toMatchObject({ status: 401, code: 'unauthorized', details: unauthorizedDetails });
    expect((error as { headers: Headers }).headers.get('x-error-fixture'), fixture.id).toBe(fixture.id);
  }
});

test('idempotent Ads writes preserve fresh 201 and replay 200 responses', async () => {
  const seenKeys: string[] = [];
  let attempt = 0;
  const bodies = [{ adAccount: { id: 'act_1' }, replayed: false }, { adAccount: { id: 'act_1' }, replayed: true }];
  const client = new Adeli({ apiKey: key, baseURL, fetch: async (_input, init) => {
    seenKeys.push(new Headers(init?.headers).get('idempotency-key') ?? '');
    const status = attempt++ === 0 ? 201 : 200;
    return new Response(JSON.stringify(bodies[status === 201 ? 0 : 1]), { status, headers: { 'content-type': 'application/json' } });
  } });
  const args = { body: { businessId: 'business', name: 'Ads', timezone: 'UTC' as const } };
  await expect(client.ads.createAdAccount(args, { idempotencyKey: 'stable-ad-key' })).resolves.toMatchObject({ status: 201, data: bodies[0] });
  await expect(client.ads.createAdAccount(args, { idempotencyKey: 'stable-ad-key' })).resolves.toMatchObject({ status: 200, data: bodies[1] });
  expect(seenKeys).toEqual(['stable-ad-key', 'stable-ad-key']);
});
