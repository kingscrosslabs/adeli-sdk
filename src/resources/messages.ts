import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { OperationJsonBody as JsonBody, OperationQuery as JsonQuery, OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';

export type MessagesQuery = JsonQuery<'listMessages'>;
export type ListMessagesQuery = MessagesQuery;
export type SendMessageBody = JsonBody<'sendMessage'>;
export type MessagesResponse = SuccessBody<'listMessages'>;
/** A stored direct message. `conversationKey` (`<platform>:<counterparty id>`) identifies its conversation within `accountId`. */
export type Message = MessagesResponse['messages'][number];
export type SentMessage = SuccessBody<'sendMessage'>;
export type SendInstagramMessageBody = JsonBody<'sendInstagramMessage'>;
export type SentInstagramMessage = SuccessBody<'sendInstagramMessage'>;

export class MessagesResource {
  constructor(private readonly transport: Transport) {}
  /**
   * List messages. With `conversationKey` (which requires `accountId`), one
   * conversation: the newest `limit` messages (default 50, at most 100) before
   * `cursor`, oldest first, and `nextCursor` toward older messages. To walk a
   * whole conversation, use `iterateConversation` from `@adeli/sdk/helpers`.
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
}
