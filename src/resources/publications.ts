import type { components } from '../generated/api.js';
import type { OperationJsonBody as JsonBody, OperationPath as Path, OperationQuery as Query, OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';
import type { DirectUploadOptions } from '../uploads.js';
import { collectFiles, resolveProfileId, stageUploadGroups, type CollectedFile, type UploadGroup, type UploadPlatform } from './media-staging.js';
import type { BinaryUpload } from './posts.js';

/** One post to several accounts, and each account's outcome. */
export type Publication = components['schemas']['Publication'];
/**
 * `scheduled` waits for `scheduledFor` and `draft` waits to be published; `queued` and
 * `processing` are in flight; `published`, `partial`, `failed`, and `canceled` are terminal.
 */
export type PublicationStatus = Publication['status'];
/** One account the publication posts to. `result` is that platform's `createPost` response once it is known. */
export type PublicationTarget = Publication['targets'][number];
/** `outcome_unknown` means the post may already be live; it is never retried. */
export type PublicationTargetStatus = PublicationTarget['status'];
export type PublicationPlatform = PublicationTarget['platform'];
export type CreatePublicationBody = JsonBody<'createPublication'>;
export type PublicationTargetBody = CreatePublicationBody['platforms'][number];
export type PublicationPath = Path<'getPublication'>;
export type ListPublicationsQuery = Query<'listPublications'>;
export type PublicationListResponse = SuccessBody<'listPublications'>;
/** `scheduledFor` reschedules (a draft becomes scheduled); `platforms` with optional `content` and `media` replaces the post. */
export type UpdatePublicationBody = JsonBody<'updatePublication'>;

type SharedMediaItem = NonNullable<CreatePublicationBody['media']>[number];
type TargetMediaItem = NonNullable<PublicationTargetBody['media']>[number];
/** A target whose `media` may also hold Blob/File values (or `{ file, ...fields }`, such as Instagram `altText`). */
export type PublicationTargetWithFiles = Omit<PublicationTargetBody, 'media'> & {
  readonly media?: readonly (TargetMediaItem | BinaryUpload | ({ readonly file: BinaryUpload } & Readonly<Record<string, unknown>>))[];
};
/** The generated body with Blob/File alternatives in the shared and per-target media. */
export type CreatePublicationWithFiles = Omit<CreatePublicationBody, 'media' | 'platforms'> & {
  readonly media?: readonly (SharedMediaItem | BinaryUpload | { readonly file: BinaryUpload })[];
  readonly platforms: readonly PublicationTargetWithFiles[];
};
export interface CreatePublicationOptions extends DirectUploadOptions {
  /**
   * A stable key makes the create safe to repeat: the same key and body return the
   * original publication with `200`, and a different body answers `409 idempotency_conflict`.
   * With a key, opt-in `maxRetries` also retries transient failures.
   */
  readonly idempotencyKey?: string | undefined;
}

function unique(platforms: readonly UploadPlatform[]): UploadPlatform[] { return [...new Set(platforms)]; }

/** Upload Blob/File media and replace each with its `upload_id`, grouping files by the platforms that use them. */
async function stagePublicationBody(transport: Transport, body: CreatePublicationWithFiles, options: DirectUploadOptions): Promise<CreatePublicationBody> {
  const sharedFiles: CollectedFile[] = [];
  const media = body.media === undefined ? undefined : collectFiles(body.media, 'media', sharedFiles);
  const groups = new Map<string, { platforms: UploadPlatform[]; files: CollectedFile[] }>();
  const addGroup = (platforms: UploadPlatform[], files: CollectedFile[]) => {
    if (!files.length) return;
    const key = [...platforms].sort().join(',');
    const group = groups.get(key) ?? { platforms, files: [] };
    group.files.push(...files);
    groups.set(key, group);
  };
  const targets = body.platforms.map((target) => {
    const files: CollectedFile[] = [];
    const staged = collectFiles(target, undefined, files) as PublicationTargetBody;
    addGroup([target.platform], files);
    return staged;
  });
  // Shared media goes to every target that does not bring its own.
  const users = body.platforms.filter((target) => target.media === undefined).map((target) => target.platform);
  addGroup(unique(users.length ? users : body.platforms.map((target) => target.platform)), sharedFiles);
  const staged = { ...body, ...(media === undefined ? {} : { media }), platforms: targets } as CreatePublicationBody;
  if (!groups.size) return staged;
  const accountId = body.platforms[0]?.accountId;
  if (typeof accountId !== 'string') throw new TypeError('accountId is required for media upload');
  const profileId = await resolveProfileId(transport, accountId, body.profileId, options);
  await stageUploadGroups(transport, profileId, [...groups.values()] satisfies UploadGroup[], options);
  return staged;
}

export class PublicationsResource {
  constructor(private readonly transport: Transport) {}
  /**
   * Publish one post to several accounts. Every target is validated before
   * anything is written; the `202` publication then publishes in the background.
   * Follow it with `getPublication` or `waitForPublication` from `@adeli/sdk/helpers`.
   *
   * With `scheduledFor` (ISO 8601 with an offset, one minute to 365 days ahead) the
   * publication is stored as `scheduled` with `201` and published within about a
   * minute of that time; with `draft: true` it is stored as a `draft`. Staged media
   * is kept until then.
   *
   * Blob/File media is uploaded first. A shared file is uploaded once for every
   * platform that uses it, and a target's own file for that platform only. Each
   * call uploads again, so to repeat a file-backed create with the same
   * `idempotencyKey`, stage the files with `posts.createMediaUploads` and pass
   * their `upload_id`s instead.
   */
  async createPublication(args: { readonly body: CreatePublicationWithFiles | CreatePublicationBody }, options: CreatePublicationOptions = {}): Promise<ApiResponse<Publication>> {
    const body = await stagePublicationBody(this.transport, args.body as CreatePublicationWithFiles, options);
    return this.transport.request({ operation: operations.createPublication, body, idempotencyKey: options.idempotencyKey, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  /** The publication's status, its overall `progress` from 0 to 1, and each target's status, result, and error. */
  getPublication(args: { readonly path: PublicationPath }, options: RequestOptions = {}): Promise<ApiResponse<Publication>> {
    return this.transport.request({ operation: operations.getPublication, path: args.path, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  /**
   * Re-run only `failed` targets with their original inputs; `outcome_unknown`
   * targets are never retried. Answers `409` while the publication is running or
   * when nothing failed. Never retried automatically.
   */
  retryPublication(args: { readonly path: PublicationPath }, options: RequestOptions = {}): Promise<ApiResponse<Publication>> {
    return this.transport.request({ operation: operations.retryPublication, path: args.path, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  /** A profile's publications: soonest first with `status: 'scheduled'`, newest first otherwise. Page with `nextCursor`. */
  listPublications(args: { readonly query?: ListPublicationsQuery } = {}, options: RequestOptions = {}): Promise<ApiResponse<PublicationListResponse>> {
    return this.transport.request({ operation: operations.listPublications, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  /**
   * Reschedule a `scheduled` publication or `draft`, or replace its post. Answers
   * `409` once it has started or was canceled. Never retried automatically.
   */
  updatePublication(args: { readonly path: PublicationPath; readonly body: UpdatePublicationBody }, options: RequestOptions = {}): Promise<ApiResponse<Publication>> {
    return this.transport.request({ operation: operations.updatePublication, path: args.path, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  /** Publish a `scheduled` publication or `draft` now (`202`). Answers `409` once it has started or was canceled. Never retried automatically. */
  publishPublication(args: { readonly path: PublicationPath }, options: RequestOptions = {}): Promise<ApiResponse<Publication>> {
    return this.transport.request({ operation: operations.publishPublication, path: args.path, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  /** Cancel a `scheduled` publication or delete a `draft` before it starts; its kept media is deleted. Never retried automatically. */
  cancelPublication(args: { readonly path: PublicationPath }, options: RequestOptions = {}): Promise<ApiResponse<Publication>> {
    return this.transport.request({ operation: operations.cancelPublication, path: args.path, signal: options.signal, timeoutMs: options.timeoutMs });
  }
}
