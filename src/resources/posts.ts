import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { OperationJsonBody as JsonBody, OperationPath as Path, OperationQuery as JsonQuery, OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';
import type { DirectUploadOptions } from '../uploads.js';
import { collectFiles, resolveProfileId, stageUploadGroups, type CollectedFile } from './media-staging.js';

export type PostsQuery = JsonQuery<'listPosts'>;
export type ListPostsQuery = PostsQuery;
export type CreatePostBody = JsonBody<'createPost'>;
/** Name one `platform`, or several `platforms` to upload each file once and use it in a publication to all of them. */
export type CreateMediaUploadsBody = JsonBody<'createMediaUploads'>;
export type CreateMediaUploadsResponse = SuccessBody<'createMediaUploads'>;
export type PostListResponse = SuccessBody<'listPosts'>;
export type DeletePostResponse = SuccessBody<'deleteXPost'>;
export type InstagramPostStatusResponse = SuccessBody<'getInstagramPostStatus'>;
export type FacebookPostStatusResponse = SuccessBody<'getFacebookPostStatus'>;
export type TikTokPostStatusResponse = SuccessBody<'getTikTokPostStatus'>;
export type TikTokCreatorInfoResponse = SuccessBody<'getTikTokCreatorInfo'>;
export type YouTubeVideoStatusResponse = SuccessBody<'getYouTubeVideoStatus'>;
export type YouTubeUploadResponse = SuccessBody<'uploadYouTubeVideo'>;
export type YouTubeStagedUploadBody = JsonBody<'uploadYouTubeVideo'>;

/** A Blob/File sent directly to private S3. File names are retained when provided by the Node adapter. */
export type BinaryUpload = Blob & { readonly name?: string };
export type UploadableMedia<T> = T | BinaryUpload | ({ readonly file: BinaryUpload } & (T extends object ? Partial<T> : object));
type MediaKey = 'image' | 'images' | 'reel' | 'story' | 'carousel' | 'video' | 'photos' | 'media' | 'thumbnail';
type UploadableValue<K, V> = K extends MediaKey
  ? V extends readonly (infer Item)[] ? readonly UploadableMedia<UploadableDeep<Item>>[] : UploadableMedia<UploadableDeep<V>>
  : UploadableDeep<V>;
type UploadableDeep<T> = T extends readonly (infer Item)[] ? readonly UploadableDeep<Item>[] : T extends object ? { readonly [K in keyof T]: UploadableValue<K, T[K]> } : T;
/** Generated post union with Blob/File alternatives added at every media field, including thread parts. */
export type CreatePostWithFiles = UploadableDeep<CreatePostBody>;

/** Backwards-compatible name for the existing high-level TikTok file body. */
export interface TikTokMultipartBody {
  readonly platform: 'tiktok';
  readonly accountId: string;
  readonly profileId?: string;
  readonly video?: BinaryUpload;
  readonly photos?: readonly BinaryUpload[];
  readonly post_mode?: 'DIRECT_POST' | 'MEDIA_UPLOAD';
  readonly tiktok_title?: string;
  readonly tiktok_description?: string;
  readonly privacy_level?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';
  readonly disable_comment?: boolean;
  readonly disable_duet?: boolean;
  readonly disable_stitch?: boolean;
  readonly cover_timestamp?: number;
  readonly photo_cover_index?: number;
  readonly auto_add_music?: boolean;
  readonly is_aigc?: boolean;
  readonly brand_content_toggle?: boolean;
  readonly brand_organic_toggle?: boolean;
  readonly music_usage_confirmed: true;
  /** Strip CapCut and other editors' tags from the video so TikTok does not credit that editor. Adeli defaults to `true`. */
  readonly remove_editor_attribution?: boolean;
}
export type DeletePostPath = Path<'deleteXPost'>;
export type DeletePostQuery = JsonQuery<'deleteXPost'>;
export type PostStatusQuery = JsonQuery<'getFacebookPostStatus'>;
export interface YouTubeUploadBody {
  readonly platform?: 'youtube';
  readonly accountId: string;
  readonly profileId?: string;
  readonly video: BinaryUpload;
  readonly thumbnail?: BinaryUpload;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly category_id?: string;
  readonly privacy_status: 'public' | 'unlisted' | 'private';
  readonly made_for_kids: boolean;
  readonly contains_synthetic_media?: boolean;
  readonly publish_at?: string;
  readonly notify_subscribers?: boolean;
}
export type UploadYouTubeVideoBody = YouTubeUploadBody;

type Platform = NonNullable<CreateMediaUploadsBody['platform']>;

export class PostsResource {
  constructor(private readonly transport: Transport) {}
  listPosts(args: { readonly query?: PostsQuery } = {}, options: RequestOptions = {}): Promise<ApiResponse<PostListResponse>> {
    return this.transport.request({ operation: operations.listPosts, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  createMediaUploads(args: { readonly body: CreateMediaUploadsBody }, options: RequestOptions = {}): Promise<ApiResponse<CreateMediaUploadsResponse>> {
    return this.transport.request({ operation: operations.createMediaUploads, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  private async stageBody(body: Record<string, unknown>, options: DirectUploadOptions): Promise<Record<string, unknown>> {
    const files: CollectedFile[] = [];
    const stagedBody = collectFiles(body, undefined, files) as Record<string, unknown>;
    if (!files.length) return stagedBody;
    const platform = body.platform as Platform;
    if (!['instagram', 'facebook', 'tiktok', 'youtube', 'x', 'bluesky'].includes(platform)) throw new TypeError('A supported platform is required for media upload');
    const accountId = body.accountId;
    if (typeof accountId !== 'string') throw new TypeError('accountId is required for media upload');
    const profileId = await resolveProfileId(this.transport, accountId, typeof body.profileId === 'string' ? body.profileId : undefined, options);
    await stageUploadGroups(this.transport, profileId, [{ platforms: [platform], files }], options);
    return stagedBody;
  }
  async createPost(args: { readonly body: CreatePostWithFiles | TikTokMultipartBody }, options: DirectUploadOptions = {}): Promise<ApiResponse<SuccessBody<'createPost'>>> {
    const body = await this.stageBody(args.body as unknown as Record<string, unknown>, options);
    return this.transport.request({ operation: operations.createPost, body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  async uploadYouTubeVideo(args: { readonly body: YouTubeUploadBody | YouTubeStagedUploadBody }, options: DirectUploadOptions = {}): Promise<ApiResponse<YouTubeUploadResponse>> {
    const body = await this.stageBody({ ...args.body, platform: 'youtube' }, options);
    return this.transport.request({ operation: operations.uploadYouTubeVideo, body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  deleteXPost(args: { readonly path: Path<'deleteXPost'>; readonly query: JsonQuery<'deleteXPost'> }, options: RequestOptions = {}): Promise<ApiResponse<DeletePostResponse>> {
    return this.transport.request({ operation: operations.deleteXPost, path: args.path, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  deleteBlueskyPost(args: { readonly path: Path<'deleteBlueskyPost'>; readonly query: JsonQuery<'deleteBlueskyPost'> }, options: RequestOptions = {}): Promise<ApiResponse<SuccessBody<'deleteBlueskyPost'>>> {
    return this.transport.request({ operation: operations.deleteBlueskyPost, path: args.path, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  getInstagramPostStatus(args: { readonly query: JsonQuery<'getInstagramPostStatus'> }, options: RequestOptions = {}): Promise<ApiResponse<InstagramPostStatusResponse>> {
    return this.transport.request({ operation: operations.getInstagramPostStatus, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  getFacebookPostStatus(args: { readonly query: JsonQuery<'getFacebookPostStatus'> }, options: RequestOptions = {}): Promise<ApiResponse<FacebookPostStatusResponse>> {
    return this.transport.request({ operation: operations.getFacebookPostStatus, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  getTikTokPostStatus(args: { readonly query: JsonQuery<'getTikTokPostStatus'> }, options: RequestOptions = {}): Promise<ApiResponse<TikTokPostStatusResponse>> {
    return this.transport.request({ operation: operations.getTikTokPostStatus, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  getTikTokCreatorInfo(args: { readonly query: JsonQuery<'getTikTokCreatorInfo'> }, options: RequestOptions = {}): Promise<ApiResponse<TikTokCreatorInfoResponse>> {
    return this.transport.request({ operation: operations.getTikTokCreatorInfo, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  getYouTubeVideoStatus(args: { readonly query: JsonQuery<'getYouTubeVideoStatus'> }, options: RequestOptions = {}): Promise<ApiResponse<YouTubeVideoStatusResponse>> {
    return this.transport.request({ operation: operations.getYouTubeVideoStatus, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
}
