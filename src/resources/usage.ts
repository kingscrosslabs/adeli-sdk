import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { OperationQuery as JsonQuery, OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';
export type XUsageResponse = SuccessBody<'getXUsage'>;
export type UsageQuery = JsonQuery<'getUsage'>;
/** A profile's posts, messages and comments sent this UTC month; `limit` is null when the workspace has billing. */
export type UsageResponse = SuccessBody<'getUsage'>;

export class UsageResource {
  constructor(private readonly transport: Transport) {}
  /** This month's sends for a profile (the default profile unless `query.profileId` is given), against the free plan's limits. Past a limit, sends fail with `402 usage_limit_reached`. */
  getUsage(args: { readonly query?: UsageQuery } = {}, options: RequestOptions = {}): Promise<ApiResponse<UsageResponse>> {
    return this.transport.request({ operation: operations.getUsage, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  getXUsage(_args: Record<never, never> = {}, options: RequestOptions = {}): Promise<ApiResponse<XUsageResponse>> {
    return this.transport.request({ operation: operations.getXUsage, signal: options.signal, timeoutMs: options.timeoutMs });
  }
}
