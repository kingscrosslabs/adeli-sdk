import type { OperationJsonBody as JsonBody, OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { RequestOptions } from '../core/types.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';
import { putDirectUploads, type DirectUploadOptions } from '../uploads.js';
import type { BinaryUpload } from './posts.js';

/** Internal Blob/File staging shared by `posts` and `publications`. Not part of the public API. */
export type UploadPlatform = NonNullable<JsonBody<'createMediaUploads'>['platforms']>[number];
type MutableReference = { upload_id: string };
export type CollectedFile = { file: BinaryUpload; reference: MutableReference; purpose: 'post_media' | 'youtube_thumbnail' };

function isBlob(value: unknown): value is BinaryUpload { return typeof Blob !== 'undefined' && value instanceof Blob; }

/** Replace every Blob (or `{ file }` wrapper) with an `{ upload_id }` placeholder, recording each file in order. */
export function collectFiles(value: unknown, key: string | undefined, collected: CollectedFile[]): unknown {
  if (isBlob(value)) {
    const reference: MutableReference = { upload_id: '' };
    collected.push({ file: value, reference, purpose: key === 'thumbnail' ? 'youtube_thumbnail' : 'post_media' });
    return reference;
  }
  if (Array.isArray(value)) return value.map((item) => collectFiles(item, key, collected));
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (isBlob(record.file)) {
      const reference: MutableReference = { upload_id: '' };
      collected.push({ file: record.file, reference, purpose: key === 'thumbnail' ? 'youtube_thumbnail' : 'post_media' });
      const metadata = Object.fromEntries(Object.entries(record).filter(([name]) => name !== 'file'));
      return Object.assign(reference, metadata);
    }
    return Object.fromEntries(Object.entries(record).map(([name, item]) => [name, collectFiles(item, name, collected)]));
  }
  return value;
}

/** The account's profile, looked up only when the caller did not name one. */
export async function resolveProfileId(transport: Transport, accountId: string, explicit: string | undefined, options: RequestOptions): Promise<string> {
  if (explicit) return explicit;
  const response = await transport.request<SuccessBody<'listAccounts'>>({ operation: operations.listAccounts, query: { accountId }, signal: options.signal, timeoutMs: options.timeoutMs });
  const account = (response.data as { accounts?: Array<{ profileId?: string }> }).accounts?.[0];
  if (!account?.profileId) throw new TypeError('A profileId is required to upload media for this account');
  return account.profileId;
}

/** Files that share one platform list, declared in one `createMediaUploads` call. */
export interface UploadGroup {
  readonly platforms: readonly UploadPlatform[];
  readonly files: readonly CollectedFile[];
}

/**
 * Declare every group with `createMediaUploads` (`platform` for one platform,
 * `platforms` for several), PUT all files with one bounded worker pool so
 * `concurrency` and `onProgress` span every group, then fill each placeholder.
 */
export async function stageUploadGroups(transport: Transport, profileId: string, groups: readonly UploadGroup[], options: DirectUploadOptions): Promise<void> {
  const files: CollectedFile[] = [];
  const descriptors: SuccessBody<'createMediaUploads'>['uploads'] = [];
  for (const group of groups) {
    if (!group.files.length) continue;
    if (!group.platforms.length) throw new TypeError('A supported platform is required for media upload');
    const declaration = group.files.map(({ file, purpose }, index) => {
      if (!file.type) throw new TypeError('Every uploaded Blob needs a content type');
      return { clientId: String(files.length + index), purpose, contentType: file.type, size: file.size, ...('name' in file && typeof file.name === 'string' ? { filename: file.name } : {}) };
    });
    const target = group.platforms.length === 1 ? { platform: group.platforms[0]! } : { platforms: [...group.platforms] };
    const body: JsonBody<'createMediaUploads'> = { profileId, ...target, files: declaration };
    const initiated = await transport.request<SuccessBody<'createMediaUploads'>>({ operation: operations.createMediaUploads, body, signal: options.signal, timeoutMs: options.timeoutMs });
    descriptors.push(...initiated.data.uploads);
    files.push(...group.files);
  }
  if (!files.length) return;
  const uploadIds = await putDirectUploads(transport, descriptors, files.map(({ file }) => file), options);
  uploadIds.forEach((uploadId, index) => { files[index]!.reference.upload_id = uploadId; });
}
