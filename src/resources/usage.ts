import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';
export type XUsageResponse = SuccessBody<'getXUsage'>;
/** A profile's posts, messages and comments sent this UTC month; `limit` is null when the workspace has billing. */
export type UsageResponse = SuccessBody<'getUsage'>;

export class UsageResource {
  constructor(private readonly transport: Transport) {}
  /** This month's sends for a profile (the default profile unless `query.profileId` is given), against the free plan's limits. Past a limit, sends fail with `402 usage_limit_reached`. */
  getUsage(_args: Record<never, never> = {}, options: RequestOptions = {}): Promise<ApiResponse<UsageResponse>> {
    return this.transport.request({ operation: operations.getUsage, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  getXUsage(_args: Record<never, never> = {}, options: RequestOptions = {}): Promise<ApiResponse<XUsageResponse>> {
    return this.transport.request({ operation: operations.getXUsage, signal: options.signal, timeoutMs: options.timeoutMs });
  }
}
