import type { components } from '../generated/api.js';
import type { OperationJsonBody, OperationPath, OperationQuery, OperationSuccessBody } from '../core/generated.js';
import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';

/** Wire types for the account services and profile-scoped account handlers. */
type AccountSchema = components['schemas']['Account'];
export type CapabilityDescriptor = AccountSchema['recommendedPermissions'][number];
export type ReconnectGuidance = AccountSchema['reconnect'];
export type CapabilityRequirement = AccountSchema['capabilityRequirements'][string];
export type AccountPermissionState = Pick<AccountSchema, 'grantedPermissions' | 'recommendedPermissions' | 'missingRecommendedPermissions' | 'capabilities' | 'capabilityRequirements' | 'reconnect'>;
export interface XCapabilities { readonly analytics: boolean; readonly inbox: boolean; }
/** Aggregate account responses include the full capability/scope state. */
export type Account = AccountSchema;
/** Detail/update handlers additionally return X-specific capability toggles. */
export type AccountDetailResponse = OperationSuccessBody<'getAccount'> & { readonly xCapabilities?: XCapabilities };
export type AccountUpdateResponse = OperationSuccessBody<'updateAccount'> & { readonly xCapabilities?: XCapabilities };
export type ApiErrorRecord = components['schemas']['ApiErrorRecord'];
export type AccountsAggregateResponse = OperationSuccessBody<'listAccounts'>;
export type RefreshAccountsResponse = OperationSuccessBody<'refreshAccounts'>;
export type RefreshAccount = RefreshAccountsResponse extends { accounts: readonly (infer A)[] } ? A : never;
/** At least one capability must be supplied; the API rejects an empty object. */
export type XCapabilitiesUpdate =
  | { readonly analytics: boolean; readonly inbox?: boolean }
  | { readonly analytics?: boolean; readonly inbox: boolean };
export type UpdateAccountBody = OperationJsonBody<'updateAccount'>;
export type ListAccountsQuery = OperationQuery<'listAccounts'>;
export type AccountPath = OperationPath<'getAccount'>;
export type DisconnectAccountResponse = OperationSuccessBody<'disconnectAccount'>;

export class AccountsResource {
  constructor(private readonly transport: Transport) {}
  listAccounts(args: { readonly query?: ListAccountsQuery } = {}, options: RequestOptions = {}): Promise<ApiResponse<AccountsAggregateResponse>> {
    return this.transport.request({ operation: operations.listAccounts, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  listProfileAccounts(args: { readonly path: { readonly profileId: string } }, options: RequestOptions = {}): Promise<ApiResponse<AccountsAggregateResponse>> {
    return this.transport.request({ operation: operations.listProfileAccounts, path: args.path, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  getAccount(args: { readonly path: AccountPath }, options: RequestOptions = {}): Promise<ApiResponse<AccountDetailResponse>> {
    return this.transport.request({ operation: operations.getAccount, path: args.path, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  updateAccount(args: { readonly path: AccountPath; readonly body: UpdateAccountBody }, options: RequestOptions = {}): Promise<ApiResponse<AccountUpdateResponse>> {
    return this.transport.request({ operation: operations.updateAccount, path: args.path, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  disconnectAccount(args: { readonly path: AccountPath }, options: RequestOptions = {}): Promise<ApiResponse<DisconnectAccountResponse>> {
    return this.transport.request({ operation: operations.disconnectAccount, path: args.path, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  refreshAccounts(args: { readonly path: { readonly profileId: string } }, options: RequestOptions = {}): Promise<ApiResponse<RefreshAccountsResponse>> {
    return this.transport.request({ operation: operations.refreshAccounts, path: args.path, signal: options.signal, timeoutMs: options.timeoutMs });
  }
}
