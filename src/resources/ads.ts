import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { OperationJsonBody as JsonBody, OperationPath as Path, OperationQuery as JsonQuery, OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';

type IdempotentOptions = RequestOptions & { readonly idempotencyKey: string };
export type AdBusinessesQuery = JsonQuery<'listAdBusinesses'>;
export type ListAdBusinessesQuery = AdBusinessesQuery;
export type AdAccountsQuery = JsonQuery<'listAdAccounts'>;
export type ListAdAccountsQuery = AdAccountsQuery;
export type CreateAdAccountQuery = JsonQuery<'createAdAccount'>;
export type AdAccountQuery = JsonQuery<'getAdAccount'>;
export type AdTreeQuery = JsonQuery<'getAdTree'>;
export type AdInsightsQuery = JsonQuery<'getAdInsights'>;
export type AdLeadsQuery = JsonQuery<'listAdLeads'>;
export type ListAdLeadsQuery = AdLeadsQuery;
export type CreateCampaignQuery = JsonQuery<'createCampaign'>;
export type CreateAdAccountBody = JsonBody<'createAdAccount'>;
export type UpdateAdAccountBody = JsonBody<'updateAdAccount'>;
export type CreateCampaignBody = JsonBody<'createCampaign'>;
export type SetAdStatusBody = JsonBody<'setAdStatus'>;
export type AdAccountPath = Path<'getAdAccount'>;
export type UpdateAdAccountPath = Path<'updateAdAccount'>;
export type DeleteCampaignPath = Path<'deleteCampaign'>;
export type ListAdBusinessesResponse = SuccessBody<'listAdBusinesses'>;
export type ListAdAccountsResponse = SuccessBody<'listAdAccounts'>;
export type CreateAdAccountResponse = SuccessBody<'createAdAccount'>;
export type AdAccountResponse = SuccessBody<'getAdAccount'>;
export type AdTreeResponse = SuccessBody<'getAdTree'>;
export type AdInsightsResponse = SuccessBody<'getAdInsights'>;
export type AdLeadsResponse = SuccessBody<'listAdLeads'>;
export type CampaignResponse = SuccessBody<'createCampaign'>;
export type AdStatusResponse = SuccessBody<'setAdStatus'>;
/** TikTok Ads only: an ad group's budget, end date or name. */
export type UpdateAdGroupPath = Path<'updateAdGroup'>;
export type UpdateAdGroupQuery = JsonQuery<'updateAdGroup'>;
export type UpdateAdGroupBody = JsonBody<'updateAdGroup'>;
export type AdGroupResponse = SuccessBody<'updateAdGroup'>;
/** TikTok Ads only: location, language and interest options. */
export type AdTargetingQuery = JsonQuery<'listAdTargeting'>;
export type AdTargetingResponse = SuccessBody<'listAdTargeting'>;
/** TikTok Ads only: the brand identities an ad runs as. */
export type AdIdentitiesQuery = JsonQuery<'listAdIdentities'>;
export type AdIdentitiesResponse = SuccessBody<'listAdIdentities'>;
export type CreateAdIdentityQuery = JsonQuery<'createAdIdentity'>;
export type CreateAdIdentityBody = JsonBody<'createAdIdentity'>;
export type AdIdentityResponse = SuccessBody<'createAdIdentity'>;

function requiredIdempotency(options: IdempotentOptions | undefined): string {
  const key = options?.idempotencyKey;
  if (typeof key !== 'string' || key.trim() === '' || /[\u0000-\u001f\u007f\r\n]/.test(key)) throw new TypeError('idempotencyKey must be a nonblank valid HTTP header value');
  return key;
}

export class AdsResource {
  constructor(private readonly transport: Transport) {}
  listAdBusinesses(args: { readonly query?: AdBusinessesQuery } = {}, options: RequestOptions = {}): Promise<ApiResponse<ListAdBusinessesResponse>> { return this.transport.request({ operation: operations.listAdBusinesses, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  listAdAccounts(args: { readonly query?: AdAccountsQuery } = {}, options: RequestOptions = {}): Promise<ApiResponse<ListAdAccountsResponse>> { return this.transport.request({ operation: operations.listAdAccounts, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  createAdAccount(args: { readonly query?: CreateAdAccountQuery; readonly body: CreateAdAccountBody }, options: IdempotentOptions): Promise<ApiResponse<CreateAdAccountResponse>> {
    const idempotencyKey = requiredIdempotency(options);
    return this.transport.request({ operation: operations.createAdAccount, query: args.query, body: args.body, idempotencyKey, signal: options?.signal, timeoutMs: options?.timeoutMs });
  }
  getAdAccount(args: { readonly path: AdAccountPath; readonly query?: AdAccountQuery }, options: RequestOptions = {}): Promise<ApiResponse<AdAccountResponse>> { return this.transport.request({ operation: operations.getAdAccount, path: args.path, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  updateAdAccount(args: { readonly path: UpdateAdAccountPath; readonly query?: AdAccountQuery; readonly body: UpdateAdAccountBody }, options: RequestOptions = {}): Promise<ApiResponse<AdAccountResponse>> { return this.transport.request({ operation: operations.updateAdAccount, path: args.path, query: args.query, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs }); }
  getAdTree(args: { readonly query: AdTreeQuery }, options: RequestOptions = {}): Promise<ApiResponse<AdTreeResponse>> { return this.transport.request({ operation: operations.getAdTree, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  getAdInsights(args: { readonly query: AdInsightsQuery }, options: RequestOptions = {}): Promise<ApiResponse<AdInsightsResponse>> { return this.transport.request({ operation: operations.getAdInsights, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  listAdLeads(args: { readonly query?: AdLeadsQuery } = {}, options: RequestOptions = {}): Promise<ApiResponse<AdLeadsResponse>> { return this.transport.request({ operation: operations.listAdLeads, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  createCampaign(args: { readonly query?: CreateCampaignQuery; readonly body: CreateCampaignBody }, options: IdempotentOptions): Promise<ApiResponse<CampaignResponse>> {
    const idempotencyKey = requiredIdempotency(options);
    return this.transport.request({ operation: operations.createCampaign, query: args.query, body: args.body, idempotencyKey, signal: options?.signal, timeoutMs: options?.timeoutMs });
  }
  deleteCampaign(args: { readonly path: DeleteCampaignPath; readonly query: JsonQuery<'deleteCampaign'> }, options: RequestOptions = {}): Promise<ApiResponse<undefined>> { return this.transport.request({ operation: operations.deleteCampaign, path: args.path, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  setAdStatus(args: { readonly query?: JsonQuery<'setAdStatus'>; readonly body: SetAdStatusBody }, options: RequestOptions = {}): Promise<ApiResponse<AdStatusResponse>> { return this.transport.request({ operation: operations.setAdStatus, query: args.query, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs }); }
  updateAdGroup(args: { readonly path: UpdateAdGroupPath; readonly query?: UpdateAdGroupQuery; readonly body: UpdateAdGroupBody }, options: RequestOptions = {}): Promise<ApiResponse<AdGroupResponse>> { return this.transport.request({ operation: operations.updateAdGroup, path: args.path, query: args.query, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs }); }
  listAdTargeting(args: { readonly query: AdTargetingQuery }, options: RequestOptions = {}): Promise<ApiResponse<AdTargetingResponse>> { return this.transport.request({ operation: operations.listAdTargeting, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  listAdIdentities(args: { readonly query: AdIdentitiesQuery }, options: RequestOptions = {}): Promise<ApiResponse<AdIdentitiesResponse>> { return this.transport.request({ operation: operations.listAdIdentities, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  createAdIdentity(args: { readonly query?: CreateAdIdentityQuery; readonly body: CreateAdIdentityBody }, options: RequestOptions = {}): Promise<ApiResponse<AdIdentityResponse>> { return this.transport.request({ operation: operations.createAdIdentity, query: args.query, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs }); }
}
