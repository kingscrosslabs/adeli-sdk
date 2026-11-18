import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { PostListResponse, PostsQuery } from '../resources/posts.js';
import { abortError, isRecord, makeDeadline, malformed, requestPage, validateOptions } from './paging.js';
import type { PageIteratorOptions } from './paging.js';

export type PostIteratorQuery = PostsQuery;
export type PostIteratorOptions = PageIteratorOptions;

export interface PostsClient {
  readonly posts: {
    listPosts(args: { readonly query?: PostsQuery }, options?: RequestOptions): Promise<ApiResponse<PostListResponse>>;
  };
}

function assertPage(value: unknown): asserts value is PostListResponse {
  if (!isRecord(value) || !Array.isArray(value.posts)) throw malformed('The posts endpoint returned a malformed page');
  if (value.nextCursor !== undefined && value.nextCursor !== null && typeof value.nextCursor !== 'string') {
    throw malformed('The posts endpoint returned an invalid cursor');
  }
  for (const post of value.posts) {
    if (!isRecord(post) || typeof post.id !== 'string' || post.id.length === 0) throw malformed('The posts endpoint returned a malformed post');
  }
}

async function* pages(client: PostsClient, args: { readonly query?: PostIteratorQuery }, options: PostIteratorOptions): AsyncGenerator<ApiResponse<PostListResponse>> {
  const checked = validateOptions(options);
  let query: PostsQuery = { ...args.query };
  const deadline = makeDeadline(checked.timeoutMs);
  const seenCursors = new Set<string>();
  if (query.cursor !== undefined) seenCursors.add(query.cursor);

  for (let pageNumber = 0; pageNumber < checked.maxPages; pageNumber += 1) {
    if (checked.signal?.aborted) throw abortError();
    const pageQuery = query;
    const response = await requestPage(requestOptions => client.posts.listPosts({ query: pageQuery }, requestOptions), deadline, checked.signal);
    assertPage(response.data);
    yield response;
    const nextCursor = response.data.nextCursor;
    if (nextCursor === null || nextCursor === undefined || nextCursor === '') return;
    if (seenCursors.has(nextCursor)) return;
    seenCursors.add(nextCursor);
    query = { ...query, cursor: nextCursor };
  }
}

/**
 * Yield `listPosts` pages, newest first, following `nextCursor` until it is
 * null or `maxPages` (default 100) is reached. Each page is a full response,
 * so partial `errors` stay visible.
 */
export function iteratePostPages(client: PostsClient, args: { readonly query?: PostIteratorQuery } = {}, options: PostIteratorOptions = {}): AsyncGenerator<ApiResponse<PostListResponse>> {
  return pages(client, args, options);
}

/**
 * Yield posts newest first across pages, skipping any `id` already yielded.
 * X posts are billed per read, so bound an X listing with `maxPages`.
 */
export async function* iteratePosts(client: PostsClient, args: { readonly query?: PostIteratorQuery } = {}, options: PostIteratorOptions = {}): AsyncGenerator<PostListResponse['posts'][number]> {
  const seen = new Set<string>();
  for await (const page of pages(client, args, options)) {
    for (const post of page.data.posts) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      yield post;
    }
  }
}
