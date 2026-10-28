/** Explicit, bounded workflow helpers. They never start work until called. */
export {
  waitForConnection,
  waitForFacebookPost,
  waitForInstagramPost,
  waitForTikTokPost,
  waitForYouTubeVideo,
} from './polling.js';
export type { ConnectionPollingClient, FacebookPollingClient, InstagramPollingClient, PollingOptions, PostPollingClient, TikTokPollingClient, YouTubePollingClient } from './polling.js';
export { iterateCommentPages, iterateComments } from './comments.js';
export type { CommentIteratorOptions, CommentIteratorQuery, CommentsClient } from './comments.js';
export { DEFAULT_WEBHOOK_TOLERANCE_SECONDS, parseWebhookEvent, verifyWebhookSignature } from './webhooks.js';
export type { CommentCreatedEvent, MessagePostbackEvent, UnknownWebhookEvent, VerifyWebhookSignatureInput, WebhookEvent, WebhookEventType, WebhookPayload } from './webhooks.js';
