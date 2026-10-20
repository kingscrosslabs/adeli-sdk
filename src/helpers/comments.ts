import { CancellationError, ConfigurationError, MalformedResponseError, TimeoutError } from '@adeli/node';
import { isRepresentableTimerDuration, MAX_TIMER_DURATION_MS } from '../core/duration.js';
import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { CommentsQuery, CommentsResponse } from '../resources/comments.js';

export type CommentIteratorQuery = Omit<CommentsQuery, 'platform'> & { readonly platform: 'tiktok' | 'youtube' };

export interface CommentsClient {
  readonly comments: {
    listComments(args: { readonly query: CommentsQuery }, options?: RequestOptions): Promise<ApiResponse<CommentsResponse>>;
  };
}

export interface CommentIteratorOptions {
  /** Maximum number of requests. The default is deliberately finite. */
  readonly maxPages?: number;
  /** Total wall-clock budget for all pages, including request time. */
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

const DEFAULT_MAX_PAGES = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validateOptions(options: CommentIteratorOptions): Required<Pick<CommentIteratorOptions, 'maxPages'>> & CommentIteratorOptions {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  if (!Number.isFinite(maxPages) || maxPages <= 0 || !Number.isInteger(maxPages)) {
    throw new ConfigurationError('maxPages must be a finite positive integer');
  }
  if (options.timeoutMs !== undefined && !isRepresentableTimerDuration(options.timeoutMs)) {
    throw new ConfigurationError(`timeoutMs must be a positive finite number no greater than ${MAX_TIMER_DURATION_MS}ms`);
  }
  return { ...options, maxPages };
}

function abortError(): CancellationError {
  return new CancellationError('The helper operation was cancelled');
}

function timeoutError(): TimeoutError {
  return new TimeoutError('The helper operation exceeded its total timeout');
}

function malformed(message: string): MalformedResponseError {
  return new MalformedResponseError(message);
}

function assertPage(value: unknown): asserts value is CommentsResponse {
  if (!isRecord(value) || !Array.isArray(value.comments)) {
    throw malformed('The comments endpoint returned a malformed page');
  }
  if ('postId' in value && value.postId !== null && value.postId !== undefined && typeof value.postId !== 'string') {
    throw malformed('The comments endpoint returned an invalid post identity');
  }
  if (value.nextCursor !== undefined && value.nextCursor !== null && typeof value.nextCursor !== 'string') {
    throw malformed('The comments endpoint returned an invalid cursor');
  }
  for (const comment of value.comments) {
    if (!isRecord(comment) || typeof comment.id !== 'string' || comment.id.length === 0) {
      throw malformed('The comments endpoint returned a malformed comment');
    }
  }
}

function assertScope(page: CommentsResponse, query: CommentsQuery): void {
  if (page.platform !== query.platform || page.accountId !== query.accountId) {
    throw malformed('The comments endpoint changed the requested account scope');
  }
  if (query.profileId !== undefined && page.profileId !== query.profileId) {
    throw malformed('The comments endpoint changed the requested profile scope');
  }
  if (query.postId !== undefined && page.postId !== query.postId) {
    throw malformed('The comments endpoint changed the requested post scope');
  }
}

function makeDeadline(timeoutMs: number | undefined): number | undefined {
  return timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
}

async function requestPage(
  client: CommentsClient,
  query: CommentsQuery,
  deadline: number | undefined,
  signal: AbortSignal | undefined,
): Promise<ApiResponse<CommentsResponse>> {
  if (signal?.aborted) throw abortError();
  const remaining = deadline === undefined ? undefined : deadline - Date.now();
  if (remaining !== undefined && remaining <= 0) throw timeoutError();

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  let onAbort: (() => void) | undefined;
  return new Promise<ApiResponse<CommentsResponse>>((resolve, reject) => {
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      if (onAbort !== undefined) signal?.removeEventListener('abort', onAbort);
      action();
    };
    onAbort = () => {
      controller.abort();
      finish(() => reject(abortError()));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (remaining !== undefined) {
      timer = setTimeout(() => {
        controller.abort();
        finish(() => reject(timeoutError()));
      }, remaining);
    }
    let result: Promise<ApiResponse<CommentsResponse>>;
    try {
      result = Promise.resolve(client.comments.listComments({ query }, { signal: controller.signal }));
    } catch (error) {
      finish(() => reject(error));
      return;
    }
    result.then(
      value => finish(() => {
        if (signal?.aborted) reject(abortError());
        else if (deadline !== undefined && Date.now() >= deadline) reject(timeoutError());
        else resolve(value);
      }),
      error => finish(() => {
        if (signal?.aborted) reject(abortError());
        else if (deadline !== undefined && Date.now() >= deadline) reject(timeoutError());
        else reject(error);
      }),
    );
  });
}

function validatePlatform(query: CommentIteratorQuery): void {
  if (query.platform !== 'tiktok' && query.platform !== 'youtube') {
    throw new ConfigurationError('Comment iteration is supported only for TikTok and YouTube');
  }
  if (query.cursor !== undefined && query.postId === undefined) {
    throw malformed('A comment cursor requires a selected postId');
  }
}

async function* pages(
  client: CommentsClient,
  args: { readonly query: CommentIteratorQuery },
  options: CommentIteratorOptions,
): AsyncGenerator<ApiResponse<CommentsResponse>> {
  const checked = validateOptions(options);
  validatePlatform(args.query);
  const initialQuery = { ...args.query };
  let query: CommentsQuery = { ...initialQuery };
  const deadline = makeDeadline(checked.timeoutMs);
  const seenCursors = new Set<string>();
  if (query.cursor !== undefined) seenCursors.add(query.cursor);
  let selectedPostId = query.postId;

  try {
    for (let pageNumber = 0; pageNumber < checked.maxPages; pageNumber += 1) {
      if (checked.signal?.aborted) throw abortError();
      const response = await requestPage(client, query, deadline, checked.signal);
      assertPage(response.data);
      assertScope(response.data, query);

      if (selectedPostId === undefined) {
        // Only the endpoint's authoritative postId may pin later requests.
        selectedPostId = response.data.postId ?? undefined;
        if (selectedPostId !== undefined) query = { ...query, postId: selectedPostId };
      } else if (response.data.postId !== selectedPostId) {
        throw malformed('The comments endpoint changed the selected post');
      }

      const nextCursor = response.data.nextCursor;
      if (selectedPostId === undefined && nextCursor !== null && nextCursor !== undefined && nextCursor !== '') {
        throw malformed('A comment cursor was returned without an authoritative selected post');
      }
      yield response;
      if (nextCursor === null || nextCursor === undefined || nextCursor === '') return;
      if (selectedPostId === undefined) {
        throw malformed('A comment cursor was returned without an authoritative selected post');
      }
      if (seenCursors.has(nextCursor)) return;
      seenCursors.add(nextCursor);
      query = { ...query, cursor: nextCursor };
    }
  } finally {
    // No eager page is requested: this also makes early consumer breaks cheap
    // and leaves no helper-owned timers or listeners behind.
  }
}

/** Yield complete page responses; `complete` describes cache freshness, not pagination. */
export function iterateCommentPages(
  client: CommentsClient,
  args: { readonly query: CommentIteratorQuery },
  options: CommentIteratorOptions = {},
): AsyncGenerator<ApiResponse<CommentsResponse>> {
  return pages(client, args, options);
}

/** Yield the original comment records without normalizing provider fields. */
export async function* iterateComments(
  client: CommentsClient,
  args: { readonly query: CommentIteratorQuery },
  options: CommentIteratorOptions = {},
): AsyncGenerator<CommentsResponse['comments'][number]> {
  for await (const page of pages(client, args, options)) {
    for (const comment of page.data.comments) yield comment;
  }
}
