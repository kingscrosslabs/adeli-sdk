import type { Account, ApiResponse, Profile, StartConnectionBody } from '../src/index.js';
import type { CreatePostBody, TikTokMultipartBody } from '../src/resources/posts.js';
import type { CreateAdAccountBody } from '../src/resources/ads.js';
import { Adeli } from '../src/index.js';

const id = '00000000-0000-0000-0000-000000000001';
const image = { contentType: 'image/jpeg' as const, base64: 'aGVsbG8=' };

const instagramImage: CreatePostBody = { platform: 'instagram', accountId: id, image };
const youtubeVideo: CreatePostBody = { platform: 'youtube', accountId: id, title: 'video', privacy_status: 'private', made_for_kids: false, video: { url: 'https://media.example/video.mp4' } };
const tiktokFiles: TikTokMultipartBody = { platform: 'tiktok', accountId: id, music_usage_confirmed: true, video: new Blob(['video'], { type: 'video/mp4' }), disable_comment: false, photo_cover_index: 0 };
const adAccount: CreateAdAccountBody = { businessId: 'business', name: 'account', timezone: 'UTC' };
const nullableProfile: Profile = { id, name: 'profile', externalId: null, metadata: null, isDefault: false, createdAt: '', updatedAt: '' };
const completeAccount: Account = {
  id, accountId: id, profileId: id, platform: 'x', providerId: null, displayName: null, displayIdentifier: null,
  connectionStatus: 'connected', grantedPermissions: [], recommendedPermissions: [], missingRecommendedPermissions: [],
  capabilities: {}, capabilityRequirements: {}, reconnect: { action: 'restart_oauth', method: 'POST', href: null, provider: 'x' },
};
const supportedConnection: StartConnectionBody = { platform: 'youtube' };
void nullableProfile;
void completeAccount;
void supportedConnection;
void instagramImage;
void youtubeVideo;
void tiktokFiles;
void adAccount;

// @ts-expect-error platform discriminant rejects an Instagram body labelled as YouTube.
const invalidPlatform: CreatePostBody = { platform: 'youtube', accountId: id, image };
// @ts-expect-error YouTube requires privacy_status, made_for_kids, and video.
const invalidYouTube: CreatePostBody = { platform: 'youtube', accountId: id, title: 'missing fields' };
// @ts-expect-error Ads creation requires the timezone field from the generated request contract.
const invalidAdAccount: CreateAdAccountBody = { businessId: 'business', name: 'account' };
// @ts-expect-error Google Business Profile is deliberately hidden from the public connection contract.
const hiddenConnection: StartConnectionBody = { platform: 'google_business_profile' };
void hiddenConnection;
void invalidPlatform;
void invalidYouTube;
void invalidAdAccount;

async function knownResponseFields(client: Adeli): Promise<void> {
  const response: ApiResponse<{ readonly status: string; readonly posts: readonly unknown[]; readonly errors: readonly unknown[] }> = await client.posts.listPosts({});
  const status: string = response.data.status;
  const posts: readonly unknown[] = response.data.posts;
  const errors: readonly unknown[] = response.data.errors;
  void status;
  void posts;
  void errors;
}

async function requiredArguments(client: Adeli): Promise<void> {
  await client.comments.listComments({ query: { platform: 'youtube', accountId: id } });
  await client.posts.deleteXPost({ path: { postId: id }, query: { accountId: id } });
  await client.ads.createAdAccount({ body: adAccount }, { idempotencyKey: 'stable' });
  const deleted = await client.ads.deleteCampaign({ path: { campaignId: id }, query: { adAccountId: 'act_1' } });
  const noContent: undefined = deleted.data;
  void noContent;
  // @ts-expect-error listComments requires its accountId and platform query fields.
  await client.comments.listComments({ query: { platform: 'youtube' } });
  // @ts-expect-error createAdAccount requires a public idempotency key option.
  await client.ads.createAdAccount({ body: adAccount });
  // @ts-expect-error deleteXPost requires both path and accountId query fields.
  await client.posts.deleteXPost({ path: { postId: id }, query: {} });
  // @ts-expect-error deleteCampaign requires its adAccountId scope query.
  await client.ads.deleteCampaign({ path: { campaignId: id } });
}

void knownResponseFields;
void requiredArguments;
