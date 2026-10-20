import { basename } from 'node:path';
import { openAsBlob } from 'node:fs';

/** Options for a file-backed upload. The bytes remain backed by the source file until consumed by fetch. */
export interface FileUploadOptions {
  readonly contentType?: string;
  readonly name?: string;
}

/** Open a local file as a native Blob without reading the media into memory. */
export async function blobFromPath(path: string, options: Pick<FileUploadOptions, 'contentType'> = {}): Promise<Blob> {
  return openAsBlob(path, options.contentType === undefined ? undefined : { type: options.contentType });
}

/** Open a local file as a native File, retaining its filename and MIME type for multipart encoding. */
export async function fileFromPath(path: string, options: FileUploadOptions = {}): Promise<File> {
  const blob = await blobFromPath(path, options);
  return new File([blob], options.name ?? basename(path), options.contentType === undefined ? undefined : { type: options.contentType });
}
