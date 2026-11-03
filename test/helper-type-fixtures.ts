import type { Adeli, ApiResponse } from '@adeli/sdk';
import { iterateCommentPages, iterateComments, waitForConnection, waitForInstagramPost, waitForPublication, waitForTikTokPost, waitForYouTubeVideo } from '../src/helpers/index.js';
import type { CommentIteratorQuery } from '../src/helpers/index.js';
import type { CommentsResponse } from '../src/resources/comments.js';
import type { Publication } from '../src/resources/publications.js';

const client = {} as Adeli;
const id = '00000000-0000-0000-0000-000000000001';
const query: CommentIteratorQuery = { platform: 'youtube', accountId: id };
const pages: AsyncGenerator<ApiResponse<CommentsResponse>> = iterateCommentPages(client, { query });
const comments: AsyncGenerator<CommentsResponse['comments'][number]> = iterateComments(client, { query });
void pages;
void comments;

// @ts-expect-error Comment iterators intentionally support TikTok and YouTube only.
iterateCommentPages(client, { query: { platform: 'instagram', accountId: id } });
// @ts-expect-error Comment iterators intentionally support TikTok and YouTube only.
iterateComments(client, { query: { platform: 'facebook', accountId: id } });
// @ts-expect-error accountId is required for the selected comment scope.
iterateCommentPages(client, { query: { platform: 'youtube' } });

void waitForConnection;
void waitForInstagramPost;
void waitForTikTokPost;
void waitForYouTubeVideo;

// A publication wait needs explicit bounds and returns the publication response.
const published: Promise<ApiResponse<Publication>> = waitForPublication(client, { path: { publicationId: id } }, { intervalMs: 2_000, timeoutMs: 300_000, onProgress: (value) => { void value.progress; } });
void published;
// @ts-expect-error Polling bounds are required to make the side effect explicit.
waitForPublication(client, { path: { publicationId: id } }, {});
