import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { OperationJsonBody as JsonBody, OperationPath as Path, OperationQuery as JsonQuery, OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';

export type MessagesQuery = JsonQuery<'listMessages'>;
export type ListMessagesQuery = MessagesQuery;
export type SendMessageBody = JsonBody<'sendMessage'>;
export type MessagesResponse = SuccessBody<'listMessages'>;
/** A stored direct message. `conversationKey` (`<platform>:<counterparty id>`) identifies its conversation within `accountId`. */
export type Message = MessagesResponse['messages'][number];
/** The Instagram story a message replies to (`reply`) or mentions the account in (`mention`). Same shape as `message.created`'s `data.story`. */
export type MessageStory = NonNullable<Message['story']>;
export type SentMessage = SuccessBody<'sendMessage'>;
export type SendInstagramMessageBody = JsonBody<'sendInstagramMessage'>;
export type SentInstagramMessage = SuccessBody<'sendInstagramMessage'>;
export type GetInstagramUserPath = Path<'getInstagramUser'>;
export type GetInstagramUserQuery = JsonQuery<'getInstagramUser'>;
export type InstagramUserResponse = SuccessBody<'getInstagramUser'>;
/** Someone who messaged an Instagram account. `isFollowing` is whether they follow it; null when Instagram does not say. */
export type InstagramMessagingUser = InstagramUserResponse['user'];
export type GetInstagramConversationPath = Path<'getInstagramConversation'>;
export type GetInstagramConversationQuery = JsonQuery<'getInstagramConversation'>;
export type InstagramConversationResponse = SuccessBody<'getInstagramConversation'>;
/** One message of an Instagram conversation read live. `direction` is `outbound` when the connected account sent it. */
export type InstagramConversationMessage = InstagramConversationResponse['messages'][number];

export class MessagesResource {
  constructor(private readonly transport: Transport) {}
  /**
   * List messages. With `conversationKey` (which requires `accountId`), one
   * conversation: the newest `limit` messages (default 50, at most 100) before
   * `cursor`, oldest first, and `nextCursor` toward older messages. To walk a
   * whole conversation, use `iterateConversation` from `@adeli/sdk/helpers`.
   * With `storyId` (a message's `story.id`), only the inbound Instagram replies
   * to that story; each reply's `sender` is the IGSID to message back.
   */
  listMessages(args: { readonly query?: MessagesQuery } = {}, options: RequestOptions = {}): Promise<ApiResponse<MessagesResponse>> {
    return this.transport.request({ operation: operations.listMessages, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  /** Send a DM. WhatsApp takes an approved `template`, or free `text` inside the 24-hour window (409 `window_closed` outside it). */
  sendMessage(args: { readonly body: SendMessageBody }, options: RequestOptions = {}): Promise<ApiResponse<SentMessage>> {
    return this.transport.request({ operation: operations.sendMessage, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  sendInstagramMessage(args: { readonly body: SendInstagramMessageBody }, options: RequestOptions = {}): Promise<ApiResponse<SentInstagramMessage>> {
    return this.transport.request({ operation: operations.sendInstagramMessage, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  /**
   * Read someone who has messaged an Instagram account, live, with whether they
   * follow it (`user.isFollowing`). `igsid` is a `message.created` `from.id` or a
   * `message.postback` `senderId`. Instagram answers only after the person has
   * messaged the account or tapped one of its buttons: before that, 409
   * `user_consent_required`. An unknown id is 404 `user_not_found`.
   */
  getInstagramUser(args: { readonly path: GetInstagramUserPath; readonly query: GetInstagramUserQuery }, options: RequestOptions = {}): Promise<ApiResponse<InstagramUserResponse>> {
    return this.transport.request({ operation: operations.getInstagramUser, path: args.path, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  /**
   * Read the newest messages (`limit`, default 5, at most 20) of an Instagram
   * account's conversation with one person, live, newest first. `igsid` is a
   * `message.created` `from.id`, a `message.postback` `senderId`, or the id you
   * messaged. A postback button tap also appears as an inbound message whose
   * text is the button's title, so this finds a tap whose webhook never came.
   * No conversation is `conversationId: null` and `messages: []`. Never cached.
   */
  getInstagramConversation(args: { readonly path: GetInstagramConversationPath; readonly query: GetInstagramConversationQuery }, options: RequestOptions = {}): Promise<ApiResponse<InstagramConversationResponse>> {
    return this.transport.request({ operation: operations.getInstagramConversation, path: args.path, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
}
