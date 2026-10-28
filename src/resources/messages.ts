import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { OperationJsonBody as JsonBody, OperationQuery as JsonQuery, OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';

export type MessagesQuery = JsonQuery<'listMessages'>;
export type ListMessagesQuery = MessagesQuery;
export type SendMessageBody = JsonBody<'sendMessage'>;
export type MessagesResponse = SuccessBody<'listMessages'>;
export type SentMessage = SuccessBody<'sendMessage'>;
export type SendInstagramMessageBody = JsonBody<'sendInstagramMessage'>;
export type SentInstagramMessage = SuccessBody<'sendInstagramMessage'>;

export class MessagesResource {
  constructor(private readonly transport: Transport) {}
  listMessages(args: { readonly query?: MessagesQuery } = {}, options: RequestOptions = {}): Promise<ApiResponse<MessagesResponse>> {
    return this.transport.request({ operation: operations.listMessages, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  sendMessage(args: { readonly body: SendMessageBody }, options: RequestOptions = {}): Promise<ApiResponse<SentMessage>> {
    return this.transport.request({ operation: operations.sendMessage, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  sendInstagramMessage(args: { readonly body: SendInstagramMessageBody }, options: RequestOptions = {}): Promise<ApiResponse<SentInstagramMessage>> {
    return this.transport.request({ operation: operations.sendInstagramMessage, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
}
