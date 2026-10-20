import { randomUUID } from 'node:crypto';
import type { ApiResponse, MultipartBody, RequestOptions } from '../core/types.js';
import type { OperationJsonBody as JsonBody, OperationPath as Path, OperationQuery as JsonQuery, OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';

export type PostsQuery = JsonQuery<'listPosts'>;
export type ListPostsQuery = PostsQuery;
export type CreatePostBody = JsonBody<'createPost'>;
export type PostListResponse = SuccessBody<'listPosts'>;
export type DeletePostResponse = SuccessBody<'deleteXPost'>;
export type FacebookPostStatusResponse = SuccessBody<'getFacebookPostStatus'>;
export type TikTokPostStatusResponse = SuccessBody<'getTikTokPostStatus'>;
export type TikTokCreatorInfoResponse = SuccessBody<'getTikTokCreatorInfo'>;
export type YouTubeVideoStatusResponse = SuccessBody<'getYouTubeVideoStatus'>;
export type YouTubeUploadResponse = SuccessBody<'uploadYouTubeVideo'>;

/** A Blob/File accepted by multipart methods. File names are retained when provided by the Node adapter. */
export type BinaryUpload = Blob & { readonly name?: string };
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

type MultipartField = { readonly name: string; readonly value: string };
type MultipartFile = { readonly name: string; readonly file: BinaryUpload };
function scalarFields(body: Record<string, unknown>, skip: ReadonlySet<string>): MultipartField[] {
  const fields: MultipartField[] = [];
  for (const [name, value] of Object.entries(body)) {
    if (skip.has(name) || value === undefined || value === null || typeof value === 'object') continue;
    fields.push({ name, value: String(value) });
  }
  return fields;
}
function safeHeaderValue(value: string): string { return value.replace(/["\\\r\n]/g, '_'); }
function streamingMultipart(fields: readonly MultipartField[], files: readonly MultipartFile[]): MultipartBody {
  const boundary = `----adeli-${randomUUID()}`;
  const encoder = new TextEncoder();
  const encodedFields = fields.map(({ name, value }) => encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${safeHeaderValue(name)}"\r\n\r\n${value}\r\n`));
  const encodedFiles = files.map(({ name, file }) => encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${safeHeaderValue(name)}"; filename="${safeHeaderValue(file.name ?? name)}"\r\nContent-Type: ${safeHeaderValue(file.type || 'application/octet-stream')}\r\n\r\n`));
  const ending = encoder.encode(`--${boundary}--\r\n`);
  async function* parts(): AsyncGenerator<Uint8Array> {
    for (const field of encodedFields) yield field;
    for (let index = 0; index < files.length; index += 1) {
      yield encodedFiles[index]!;
      const reader = files[index]!.file.stream().getReader();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          yield chunk.value;
        }
      } finally {
        reader.releaseLock();
      }
      yield encoder.encode('\r\n');
    }
    yield ending;
  }
  const iterator = parts();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) { controller.error(error); }
    },
    async cancel(reason) { await iterator.return(reason); },
  });
  return { stream, contentType: `multipart/form-data; boundary=${boundary}` };
}
function tiktokMultipart(body: TikTokMultipartBody): MultipartBody {
  const fields = scalarFields(body as unknown as Record<string, unknown>, new Set(['video', 'photos']));
  const files: MultipartFile[] = [];
  if (body.video !== undefined) files.push({ name: 'video', file: body.video });
  for (const photo of body.photos ?? []) files.push({ name: 'photos[]', file: photo });
  return streamingMultipart(fields, files);
}
function youtubeMultipart(body: YouTubeUploadBody): MultipartBody {
  const fields = scalarFields(body as unknown as Record<string, unknown>, new Set(['video', 'thumbnail', 'tags']));
  if (body.tags !== undefined) fields.push({ name: 'tags', value: body.tags.join(',') });
  const files: MultipartFile[] = [{ name: 'video', file: body.video }];
  if (body.thumbnail !== undefined) files.push({ name: 'thumbnail', file: body.thumbnail });
  return streamingMultipart(fields, files);
}
function isTikTokMultipart(body: CreatePostBody | TikTokMultipartBody): body is TikTokMultipartBody {
  return body.platform === 'tiktok' && ((body.video !== undefined && body.video instanceof Blob) || (Array.isArray(body.photos) && body.photos.some((photo) => photo instanceof Blob)));
}

export class PostsResource {
  constructor(private readonly transport: Transport) {}
  listPosts(args: { readonly query?: PostsQuery } = {}, options: RequestOptions = {}): Promise<ApiResponse<PostListResponse>> {
    return this.transport.request({ operation: operations.listPosts, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  createPost(args: { readonly body: CreatePostBody | TikTokMultipartBody }, options: RequestOptions = {}): Promise<ApiResponse<SuccessBody<'createPost'>>> {
    const body = isTikTokMultipart(args.body) ? tiktokMultipart(args.body) : args.body;
    return this.transport.request({ operation: operations.createPost, body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  uploadYouTubeVideo(args: { readonly body: YouTubeUploadBody }, options: RequestOptions = {}): Promise<ApiResponse<YouTubeUploadResponse>> {
    return this.transport.request({ operation: operations.uploadYouTubeVideo, body: youtubeMultipart(args.body), signal: options.signal, timeoutMs: options.timeoutMs });
  }
  deleteXPost(args: { readonly path: Path<'deleteXPost'>; readonly query: JsonQuery<'deleteXPost'> }, options: RequestOptions = {}): Promise<ApiResponse<DeletePostResponse>> {
    return this.transport.request({ operation: operations.deleteXPost, path: args.path, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  deleteBlueskyPost(args: { readonly path: Path<'deleteBlueskyPost'>; readonly query: JsonQuery<'deleteBlueskyPost'> }, options: RequestOptions = {}): Promise<ApiResponse<SuccessBody<'deleteBlueskyPost'>>> {
    return this.transport.request({ operation: operations.deleteBlueskyPost, path: args.path, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
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
