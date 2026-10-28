import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { OperationJsonBody as JsonBody, OperationPath as Path, OperationQuery as JsonQuery, OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';

export type ListWebhooksQuery = JsonQuery<'listWebhooks'>;
export type CreateWebhookBody = JsonBody<'createWebhook'>;
export type WebhooksResponse = SuccessBody<'listWebhooks'>;
export type Webhook = WebhooksResponse['webhooks'][number];
/** The created webhook and its signing secret. The secret is returned only here. */
export type CreatedWebhook = SuccessBody<'createWebhook'>;

export class WebhooksResource {
  constructor(private readonly transport: Transport) {}
  listWebhooks(args: { readonly query: ListWebhooksQuery }, options: RequestOptions = {}): Promise<ApiResponse<WebhooksResponse>> {
    return this.transport.request({ operation: operations.listWebhooks, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  createWebhook(args: { readonly body: CreateWebhookBody }, options: RequestOptions = {}): Promise<ApiResponse<CreatedWebhook>> {
    return this.transport.request({ operation: operations.createWebhook, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  deleteWebhook(args: { readonly path: Path<'deleteWebhook'> }, options: RequestOptions = {}): Promise<ApiResponse<undefined>> {
    return this.transport.request({ operation: operations.deleteWebhook, path: args.path, signal: options.signal, timeoutMs: options.timeoutMs });
  }
}
