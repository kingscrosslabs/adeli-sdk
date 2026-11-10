import type { Account, ApiResponse, Profile, StartConnectionBody } from '../src/index.js';
import type { CreatePostBody, CreatePostWithFiles, TikTokMultipartBody } from '../src/resources/posts.js';
import type { CreateAdAccountBody } from '../src/resources/ads.js';
import type { ListMessagesQuery, SendInstagramMessageBody, SendMessageBody } from '../src/resources/messages.js';
import { Adeli } from '../src/index.js';

const id = '00000000-0000-0000-0000-000000000001';
const image = { contentType: 'image/jpeg' as const, base64: 'aGVsbG8=' };

const instagramImage: CreatePostBody = { platform: 'instagram', accountId: id, image };
const linkedinPost: CreatePostBody = { platform: 'linkedin', accountId: id, commentary: 'A new update', image: { content_type: 'image/png', base64: 'aGVsbG8=', title: 'Launch' } };
const linkedinStagedImage: CreatePostBody = { platform: 'linkedin', accountId: id, commentary: 'Thanks @Acme', image: { upload_id: 'staged-image', title: 'Launch' }, mentions: [{ urn: 'urn:li:organization:9', name: 'Acme', offset: 7 }] };
const linkedinImages: CreatePostBody = { platform: 'linkedin', accountId: id, commentary: 'Launch day', images: [{ upload_id: 'a', alt_text: 'The stage' }, { upload_id: 'b' }] };
const linkedinVideo: CreatePostBody = { platform: 'linkedin', accountId: id, commentary: 'Watch', video: { upload_id: 'staged-video', title: 'Demo' } };
const linkedinDocument: CreatePostBody = { platform: 'linkedin', accountId: id, commentary: 'Our Q3 results', document: { upload_id: 'staged-pdf', title: 'Q3 deck' } };
const youtubeVideo: CreatePostBody = { platform: 'youtube', accountId: id, title: 'video', privacy_status: 'private', made_for_kids: false, video: { url: 'https://media.example/video.mp4' } };
const tiktokFiles: TikTokMultipartBody = { platform: 'tiktok', accountId: id, music_usage_confirmed: true, remove_editor_attribution: false, video: new Blob(['video'], { type: 'video/mp4' }), disable_comment: false, photo_cover_index: 0 };
const file = new File(['media'], 'media.jpg', { type: 'image/jpeg' });
const instagramFile: CreatePostWithFiles = { platform: 'instagram', accountId: id, image: { file, altText: 'Bird' } };
const facebookFile: CreatePostWithFiles = { platform: 'facebook', accountId: id, image: file };
const tiktokFile: CreatePostWithFiles = { platform: 'tiktok', accountId: id, music_usage_confirmed: true, photos: [file] };
const youtubeFile: CreatePostWithFiles = { platform: 'youtube', accountId: id, title: 'Video', privacy_status: 'private', made_for_kids: false, video: new File(['v'], 'v.mp4', { type: 'video/mp4' }) };
const xFile: CreatePostWithFiles = { platform: 'x', accountId: id, text: 'Bird', media: [file], thread: [{ text: 'More', media: [file] }] };
const blueskyFile: CreatePostWithFiles = { platform: 'bluesky', accountId: id, text: 'Bird', images: [{ file, altText: 'Bird' }] };
void instagramFile; void facebookFile; void tiktokFile; void youtubeFile; void xFile; void blueskyFile;

const adAccount: CreateAdAccountBody = { businessId: 'business', name: 'account', timezone: 'UTC' };
const nullableProfile: Profile = { id, name: 'profile', externalId: null, metadata: null, isDefault: false, createdAt: '', updatedAt: '' };
const completeAccount: Account = {
  id, accountId: id, profileId: id, platform: 'x', providerId: null, displayName: null, displayIdentifier: null,
  connectionStatus: 'connected', grantedPermissions: [], recommendedPermissions: [], missingRecommendedPermissions: [],
  capabilities: {}, capabilityRequirements: {}, reconnect: { action: 'restart_oauth', method: 'POST', href: null, provider: 'x' },
};
const supportedConnection: StartConnectionBody = { platform: 'youtube' };
const linkedinConnection: StartConnectionBody = { platform: 'linkedin' };
void nullableProfile;
void completeAccount;
void supportedConnection;
void linkedinConnection;
void linkedinPost;
void linkedinStagedImage;
void linkedinImages;
void linkedinVideo;
void linkedinDocument;
void instagramImage;
void youtubeVideo;
void tiktokFiles;
void adAccount;

const instagramDirect: SendInstagramMessageBody = { accountId: id, recipient: { id: 'igsid' }, text: 'hello' };
const instagramPrivateReply: SendInstagramMessageBody = { accountId: id, profileId: id, recipient: { commentId: 'comment-1' }, text: 'Thanks!', buttons: [{ type: 'postback', title: 'Send it', payload: 'send' }, { type: 'url', title: 'Shop', url: 'https://shop.example/' }] };
void instagramDirect;
const whatsappText: SendMessageBody = { platform: 'whatsapp', accountId: id, recipient: '+15555550123', text: 'Thanks for your message' };
const whatsappTemplate: SendMessageBody = { platform: 'whatsapp', accountId: id, recipient: '+15555550123', template: { name: 'order_update', language: 'en_US' } };
const conversationQuery: ListMessagesQuery = { accountId: id, conversationKey: 'whatsapp:15555550123', cursor: 'opaque', limit: 100 };
void whatsappText;
void whatsappTemplate;
void conversationQuery;
// @ts-expect-error a WhatsApp send carries text or a template.
const whatsappEmpty: SendMessageBody = { platform: 'whatsapp', accountId: id, recipient: '+15555550123' };
void whatsappEmpty;
void instagramPrivateReply;
// @ts-expect-error the Instagram recipient is an object, not the plain string sendMessage takes.
const invalidInstagramRecipient: SendInstagramMessageBody = { accountId: id, recipient: 'igsid', text: 'hello' };
// @ts-expect-error postback buttons require a payload.
const invalidPostback: SendInstagramMessageBody = { accountId: id, recipient: { id: 'igsid' }, text: 'hello', buttons: [{ type: 'postback', title: 'Yes' }] };
void invalidInstagramRecipient;
void invalidPostback;

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
  await client.posts.createMediaUploads({ body: { profileId: id, platform: 'youtube', files: [{ clientId: 'video', purpose: 'post_media', contentType: 'video/mp4', size: 10 }] } });
  await client.posts.createMediaUploads({ body: { profileId: id, platform: 'linkedin', files: [{ clientId: 'deck', purpose: 'post_media', contentType: 'application/pdf', size: 10 }] } });
  await client.posts.getInstagramPostStatus({ query: { jobId: id, profileId: id } });
  await client.posts.createMediaUploads({ body: { profileId: id, platforms: ['instagram', 'tiktok', 'youtube'], files: [{ clientId: 'video', purpose: 'post_media', contentType: 'video/mp4', size: 10 }] } });
  const created = await client.publications.createPublication({ body: {
    content: 'Launch', media: [new Blob(['v'], { type: 'video/mp4' })],
    platforms: [{ platform: 'instagram', accountId: id, kind: 'reel' }, { platform: 'x', accountId: id, media: [{ file: new Blob(['i'], { type: 'image/jpeg' }), altText: 'alt' }] }],
  } }, { idempotencyKey: 'launch' });
  const publicationStatus: 'scheduled' | 'draft' | 'queued' | 'processing' | 'published' | 'partial' | 'failed' | 'canceled' = created.data.status;
  const targetStatus: 'queued' | 'submitting' | 'processing' | 'published' | 'failed' | 'outcome_unknown' | undefined = created.data.targets[0]?.status;
  void publicationStatus;
  void targetStatus;
  await client.publications.retryPublication({ path: { publicationId: created.data.id } });
  const scheduled = await client.publications.createPublication({ body: { content: 'Later', platforms: [{ platform: 'x', accountId: id }], scheduledFor: '2026-11-13T07:30:00-05:00', timeZone: 'America/New_York' } });
  const scheduledFor: string | null | undefined = scheduled.data.scheduledFor;
  void scheduledFor;
  await client.publications.createPublication({ body: { platforms: [{ platform: 'x', accountId: id }], draft: true } });
  const waiting = await client.publications.listPublications({ query: { status: 'scheduled', profileId: id, limit: 10 } });
  const nextCursor: string | null = waiting.data.nextCursor;
  void nextCursor;
  await client.publications.updatePublication({ path: { publicationId: scheduled.data.id }, body: { scheduledFor: '2026-11-14T08:00:00-05:00' } });
  await client.publications.publishPublication({ path: { publicationId: scheduled.data.id } });
  await client.publications.cancelPublication({ path: { publicationId: scheduled.data.id } });
  // @ts-expect-error listPublications filters by a known status.
  await client.publications.listPublications({ query: { status: 'later' } });
  const listed = await client.posts.listPosts({ query: { profileId: id } });
  const postStatus: 'published' | 'scheduled' | undefined = listed.data.posts[0]?.status;
  void postStatus;
  // @ts-expect-error a publication needs its platforms targets.
  await client.publications.createPublication({ body: { content: 'Launch' } });
  // @ts-expect-error a publication target names a supported platform.
  await client.publications.createPublication({ body: { platforms: [{ platform: 'myspace', accountId: id }] } });
  // @ts-expect-error getPublication requires its publicationId path.
  await client.publications.getPublication({ path: {} });
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
