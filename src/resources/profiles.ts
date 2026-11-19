import type { components } from '../generated/api.js';
import type { OperationJsonBody, OperationPath, OperationSuccessBody } from '../core/generated.js';
import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';

/** Wire types for the profile and connection handlers in the public API. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonObject = { readonly [key: string]: JsonValue };
export type PublicPlatform = components['schemas']['Account']['platform'];
export type ConnectPlatform = PublicPlatform;

export type Profile = components['schemas']['Profile'];
export type ConnectionSession = components['schemas']['ConnectionSession'];
export type ConnectionSessionError = NonNullable<ConnectionSession['error']>;
export type CreateProfileBody = OperationJsonBody<'createProfile'>;
export type UpdateProfileBody = OperationJsonBody<'updateProfile'>;
export type StartConnectionBody = OperationJsonBody<'startConnection'>;
/** A capability to ask Instagram for when connecting; see `InstagramCapabilities`. */
export type InstagramConnectCapability = NonNullable<StartConnectionBody['capabilities']>[number];
/** A permission a connect will ask for, or that an account was granted. */
export type PermissionDescriptor = NonNullable<ConnectionSession['requestedPermissions']>[number];

/**
 * Presets for `startConnection`'s `capabilities` (Instagram only). Ask for what
 * your product uses and the consent screen asks only for those permissions,
 * which makes customers more likely to approve it.
 *
 * - `engagement`: read and reply to comments, read and send DMs, read posts.
 *   No publishing or Insights. What a Comment to DM product needs.
 * - `publishing`: read posts and publish. No comments, DMs or Insights.
 * - `all`: everything, the same as leaving `capabilities` out.
 */
export const InstagramCapabilities = {
  engagement: ['profile.read', 'feed.read', 'comments.read', 'comments.manage', 'inbox.read', 'inbox.send'],
  publishing: ['profile.read', 'feed.read', 'post.publish'],
  all: ['profile.read', 'feed.read', 'post.publish', 'analytics.read', 'post.analytics', 'comments.read', 'comments.manage', 'inbox.read', 'inbox.send'],
} as const satisfies Record<string, readonly InstagramConnectCapability[]>;

export type DeleteProfileResponse = OperationSuccessBody<'deleteProfile'>;
export type ListProfilesResponse = OperationSuccessBody<'listProfiles'>;
export type ProfilePath = OperationPath<'getProfile'>;
export type EmptyArgs = Record<never, never>;

export class ProfilesResource {
  constructor(private readonly transport: Transport) {}
  listProfiles(_args: EmptyArgs = {}, options: RequestOptions = {}): Promise<ApiResponse<ListProfilesResponse>> {
    return this.transport.request({ operation: operations.listProfiles, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  createProfile(args: { readonly body: CreateProfileBody }, options: RequestOptions & { readonly idempotencyKey?: string } = {}): Promise<ApiResponse<Profile>> {
    return this.transport.request({ operation: operations.createProfile, body: args.body, idempotencyKey: options.idempotencyKey, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  getProfile(args: { readonly path: ProfilePath }, options: RequestOptions = {}): Promise<ApiResponse<Profile>> {
    return this.transport.request({ operation: operations.getProfile, path: args.path, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  updateProfile(args: { readonly path: ProfilePath; readonly body: UpdateProfileBody }, options: RequestOptions = {}): Promise<ApiResponse<Profile>> {
    return this.transport.request({ operation: operations.updateProfile, path: args.path, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  deleteProfile(args: { readonly path: ProfilePath }, options: RequestOptions = {}): Promise<ApiResponse<DeleteProfileResponse>> {
    return this.transport.request({ operation: operations.deleteProfile, path: args.path, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  startConnection(args: { readonly path: ProfilePath; readonly body: StartConnectionBody }, options: RequestOptions = {}): Promise<ApiResponse<ConnectionSession>> {
    return this.transport.request({ operation: operations.startConnection, path: args.path, body: args.body, signal: options.signal, timeoutMs: options.timeoutMs });
  }
  getConnection(args: { readonly path: ProfilePath & { readonly connectionSessionId: string } }, options: RequestOptions = {}): Promise<ApiResponse<ConnectionSession>> {
    return this.transport.request({ operation: operations.getConnection, path: args.path, signal: options.signal, timeoutMs: options.timeoutMs });
  }
}
