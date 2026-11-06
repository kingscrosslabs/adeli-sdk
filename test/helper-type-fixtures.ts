import type { Adeli, ApiResponse } from '@adeli/sdk';
import { iterateCommentPages, iterateComments, iterateConversation, iterateConversationPages, parseWebhookEvent, waitForConnection, waitForInstagramPost, waitForPublication, waitForTikTokPost, waitForYouTubeVideo } from '../src/helpers/index.js';
import type { CommentIteratorQuery, ConversationIteratorQuery, MessageCreatedEvent, WebhookPlatform } from '../src/helpers/index.js';
import type { Message, MessagesResponse } from '../src/resources/messages.js';
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

const conversation: ConversationIteratorQuery = { accountId: id, conversationKey: 'whatsapp:15555550123', limit: 50 };
const conversationPages: AsyncGenerator<ApiResponse<MessagesResponse>> = iterateConversationPages(client, { query: conversation });
const conversationMessages: AsyncGenerator<Message> = iterateConversation(client, { query: conversation }, { maxPages: 10 });
void conversationPages;
void conversationMessages;
// @ts-expect-error A conversation needs its accountId scope.
iterateConversation(client, { query: { conversationKey: 'instagram:1' } });
// @ts-expect-error A conversation needs its conversationKey.
iterateConversationPages(client, { query: { accountId: id } });

const event = parseWebhookEvent('{}');
if (event.type === 'message.created') {
  const created: MessageCreatedEvent = event;
  const platform: 'instagram' | 'facebook' | 'whatsapp' = event.platform;
  const text: string | null = event.data.text;
  const key: string = event.data.conversationKey;
  const kinds: ('image' | 'video' | 'audio' | 'file')[] = event.data.attachments.map(attachment => attachment.type);
  void created; void platform; void text; void key; void kinds;
}
const webhookPlatforms: WebhookPlatform[] = ['instagram', 'tiktok', 'facebook', 'whatsapp'];
void webhookPlatforms;
// @ts-expect-error Webhooks are not registered for YouTube.
const youtubeWebhook: WebhookPlatform = 'youtube';
void youtubeWebhook;

void waitForConnection;
void waitForInstagramPost;
void waitForTikTokPost;
void waitForYouTubeVideo;

// A publication wait needs explicit bounds and returns the publication response.
const published: Promise<ApiResponse<Publication>> = waitForPublication(client, { path: { publicationId: id } }, { intervalMs: 2_000, timeoutMs: 300_000, onProgress: (value) => { void value.progress; } });
void published;
// @ts-expect-error Polling bounds are required to make the side effect explicit.
waitForPublication(client, { path: { publicationId: id } }, {});
