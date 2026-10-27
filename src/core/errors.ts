import type { components } from '../generated/api.js';

export type AdeliErrorCode = string;
export type PermissionRequiredDetails = NonNullable<components['schemas']['PermissionRequiredError']['error']['details']>;

const permissionProviders = new Set(['instagram', 'tiktok', 'facebook', 'whatsapp', 'youtube', 'x', 'bluesky']);
const permissionLists = ['requiredPermissions', 'missingPermissions', 'requiredResources', 'missingResources'] as const;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function provider(value: unknown): boolean { return typeof value === 'string' && permissionProviders.has(value); }
function descriptor(value: unknown): boolean { return record(value) && typeof value.code === 'string' && typeof value.label === 'string'; }

/** Conservative recognition, not normalization or proof that a URL is safe to follow.
 * Sparse known fields are allowed; unknown-only objects and malformed known fields are not.
 */
export function isPermissionRequiredDetails(value: unknown): value is PermissionRequiredDetails {
  try {
    if (!record(value)) return false;
    const known = new Set<string>(['provider', 'accountId', 'profileId', 'capability', 'reconnect', ...permissionLists]);
    if (!Object.keys(value).some(key => known.has(key))) return false;
    for (const key of ['accountId', 'profileId', 'capability']) if (key in value && typeof value[key] !== 'string') return false;
    if ('provider' in value && !provider(value.provider)) return false;
    for (const key of permissionLists) {
      if (key in value) {
        const entries = value[key];
        if (!Array.isArray(entries)) return false;
        for (const entry of entries) if (!descriptor(entry)) return false;
      }
    }
    if ('reconnect' in value) {
      const reconnect = value.reconnect;
      if (!record(reconnect) || reconnect.action !== 'restart_oauth') return false;
      if ('method' in reconnect && reconnect.method !== 'POST') return false;
      if ('href' in reconnect && reconnect.href !== null && typeof reconnect.href !== 'string') return false;
      if ('provider' in reconnect && !provider(reconnect.provider)) return false;
      if ('message' in reconnect && typeof reconnect.message !== 'string') return false;
    }
    return true;
  } catch {
    return false;
  }
}

export class AdeliError extends Error {
  override readonly name: string = 'AdeliError';
  constructor(message: string) { super(message); }
}

export class ConfigurationError extends AdeliError { override readonly name = 'ConfigurationError'; }
export class NetworkError extends AdeliError { override readonly name: string = 'NetworkError'; }
/** Redirects are refused and must never be retried with credentials. */
export class RedirectError extends NetworkError { override readonly name: string = 'RedirectError'; }
/** A timeout only cancels this client request; a write may still have completed remotely. */
export class TimeoutError extends AdeliError { override readonly name = 'TimeoutError'; }
export class CancellationError extends AdeliError { override readonly name = 'CancellationError'; }
export class MalformedResponseError extends AdeliError { override readonly name = 'MalformedResponseError'; }

export interface AdeliApiErrorOptions { status: number; code?: string; details?: unknown; headers?: Headers; }
export class AdeliApiError extends AdeliError {
  override readonly name: string = 'AdeliApiError';
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly headers: Headers;
  constructor(message: string, options: AdeliApiErrorOptions) {
    super(message);
    this.status = options.status;
    this.code = options.code ?? 'api_error';
    this.details = options.details;
    this.headers = options.headers ?? new Headers();
  }
}
export class AuthenticationError extends AdeliApiError { override readonly name = 'AuthenticationError'; }
export class ValidationError extends AdeliApiError { override readonly name = 'ValidationError'; }
export class RateLimitError extends AdeliApiError { override readonly name = 'RateLimitError'; }
export class PermissionRequiredError extends AdeliApiError { override readonly name = 'PermissionRequiredError'; }

export function isAdeliApiError(error: unknown): error is AdeliApiError { return error instanceof AdeliApiError; }

const VALIDATION_CODES = new Set(['invalid_request', 'invalid_profile', 'invalid_redirect_uri']);
const PERMISSION_CODES = new Set(['permission_required']);
const RATE_LIMIT_CODES = new Set(['rate_limited', 'rate_limit_exceeded', 'quota_exhausted', 'daily_quota_exceeded']);

/** Classify documented API codes, not broad status classes with unrelated semantics. */
export function apiError(message: string, options: AdeliApiErrorOptions): AdeliApiError {
  if (options.status === 401 || options.code === 'unauthorized') return new AuthenticationError(message, options);
  if (options.status === 429 || (options.code !== undefined && RATE_LIMIT_CODES.has(options.code))) return new RateLimitError(message, options);
  if (options.code !== undefined && PERMISSION_CODES.has(options.code)) return new PermissionRequiredError(message, options);
  if (options.code !== undefined && VALIDATION_CODES.has(options.code)) return new ValidationError(message, options);
  return new AdeliApiError(message, options);
}
