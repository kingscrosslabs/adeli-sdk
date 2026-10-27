import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { OperationJsonBody as JsonBody, OperationPath as Path, OperationQuery as JsonQuery, OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';

export type CommentsQuery = JsonQuery<'listComments'>;
export type ListCommentsQuery = CommentsQuery;
export type CreateCommentBody = JsonBody<'createComment'>;
export type UpdateCommentBody = JsonBody<'updateComment'>;
export type CommentsResponse = SuccessBody<'listComments'>;
export type CommentMutationResponse = SuccessBody<'createComment'>;
export type UpdatedCommentResponse = SuccessBody<'updateComment'>;

export class CommentsResource {
  constructor(private readonly transport: Transport) {}
  listComments(args: { readonly query: CommentsQuery }, options: RequestOptions = {}): Promise<ApiResponse<CommentsResponse>> {
    return this.transport.request({ operation: operations.listComments, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  createComment(args: { readonly body: CreateCommentBody }, options: RequestOptions = {}): Promise<ApiResponse<CommentMutationResponse>> {
    return this.transport.request({ operation: operations.createComment, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  updateComment(args: { readonly path: Path<'updateComment'>; readonly body: UpdateCommentBody }, options: RequestOptions = {}): Promise<ApiResponse<UpdatedCommentResponse>> {
    return this.transport.request({ operation: operations.updateComment, path: args.path, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  deleteComment(args: { readonly path: Path<'deleteComment'>; readonly query: JsonQuery<'deleteComment'> }, options: RequestOptions = {}): Promise<ApiResponse<undefined>> {
    return this.transport.request({ operation: operations.deleteComment, path: args.path, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
}
