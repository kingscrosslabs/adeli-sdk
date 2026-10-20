/** Explicit, bounded workflow helpers. They never start work until called. */
export {
  waitForConnection,
  waitForFacebookPost,
  waitForTikTokPost,
  waitForYouTubeVideo,
} from './polling.js';
export type { ConnectionPollingClient, FacebookPollingClient, PollingOptions, PostPollingClient, TikTokPollingClient, YouTubePollingClient } from './polling.js';
export { iterateCommentPages, iterateComments } from './comments.js';
export type { CommentIteratorOptions, CommentIteratorQuery, CommentsClient } from './comments.js';
