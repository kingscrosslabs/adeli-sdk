import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';
export type XUsageResponse = SuccessBody<'getXUsage'>;

export class UsageResource {
  constructor(private readonly transport: Transport) {}
  getXUsage(_args: Record<never, never> = {}, options: RequestOptions = {}): Promise<ApiResponse<XUsageResponse>> {
    return this.transport.request({ operation: operations.getXUsage, signal: options.signal, timeoutMs: options.timeoutMs });
  }
}
