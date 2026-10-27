import { basename } from 'node:path';
import { openAsBlob } from 'node:fs';
import type { RequestOptions } from './core/types.js';
import type { Transport } from './core/transport.js';

/** Options for a file-backed upload. The bytes remain backed by the source file until consumed by fetch. */
export interface FileUploadOptions {
  readonly contentType?: string;
  readonly name?: string;
}

/** Open a local file as a native Blob without reading the media into memory. */
export async function blobFromPath(path: string, options: Pick<FileUploadOptions, 'contentType'> = {}): Promise<Blob> {
  return openAsBlob(path, options.contentType === undefined ? undefined : { type: options.contentType });
}

export interface DirectUploadDescriptor {
  readonly clientId: string;
  readonly uploadId: string;
  readonly method: 'PUT';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: string;
}

export interface DirectUploadProgress { readonly loaded: number; readonly total: number; readonly completedFiles: number; readonly totalFiles: number }
export interface DirectUploadOptions extends RequestOptions {
  readonly concurrency?: number;
  readonly onProgress?: (progress: DirectUploadProgress) => void;
}

/** PUT file/blob bodies with exact signed headers, bounded concurrency, cancellation, and stable result order. */
export async function putDirectUploads(
  transport: Transport,
  descriptors: readonly DirectUploadDescriptor[],
  files: readonly Blob[],
  options: DirectUploadOptions = {},
): Promise<readonly string[]> {
  if (descriptors.length !== files.length) throw new TypeError('The media upload manifest was incomplete');
  const byId = new Map(descriptors.map((descriptor) => [descriptor.clientId, descriptor]));
  const concurrency = options.concurrency ?? 3;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 10) throw new TypeError('concurrency must be an integer between 1 and 10');
  const total = files.reduce((sum, file) => sum + file.size, 0);
  let completedBytes = 0;
  let completedFiles = 0;
  const result: string[] = new Array(files.length);
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const index = next++;
      const descriptor = byId.get(String(index));
      const file = files[index];
      if (!descriptor || !file) throw new TypeError('The media upload manifest was incomplete');
      await transport.upload(descriptor.url, descriptor.method, descriptor.headers, file, options);
      completedBytes += file.size;
      completedFiles += 1;
      options.onProgress?.({ loaded: completedBytes, total, completedFiles, totalFiles: files.length });
      result[index] = descriptor.uploadId;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()));
  return result;
}

/** Open a local file as a native File, retaining its filename and MIME type for direct upload. */
export async function fileFromPath(path: string, options: FileUploadOptions = {}): Promise<File> {
  const blob = await blobFromPath(path, options);
  return new File([blob], options.name ?? basename(path), options.contentType === undefined ? undefined : { type: options.contentType });
}
