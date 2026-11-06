import { isRepresentableTimerDuration, MAX_TIMER_DURATION_MS } from './duration.js';
import { ConfigurationError } from './errors.js';
import type { ClientOptions, Fetch } from './types.js';

/** Resolves the API key for one request attempt; a static key returns its validated constant synchronously. */
export type ApiKeySource = () => string | Promise<string>;
export interface ResolvedConfig { readonly apiKey: ApiKeySource; readonly baseURL: string; /** Undefined means use the operation's default, then 60 seconds. */ readonly timeoutMs: number | undefined; readonly maxRetries: number; readonly fetch: Fetch; }
const DEFAULT_BASE_URL = 'https://app.tryadeli.com';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function resolveConfig(options: ClientOptions = {}): ResolvedConfig {
  if (typeof window !== 'undefined') throw new ConfigurationError('Adeli is a server-side SDK and cannot run in a browser');
  const option = options.apiKey ?? globalThis.process?.env?.ADELI_API_KEY;
  let apiKey: ApiKeySource;
  if (typeof option === 'function') apiKey = apiKeyResolver(option);
  else {
    const key = validateApiKey(option, 'An Adeli API key is required (pass apiKey or set ADELI_API_KEY)');
    apiKey = () => key;
  }
  const baseURL = validateBaseURL(options.baseURL ?? DEFAULT_BASE_URL);
  const timeoutMs = options.timeoutMs;
  const maxRetries = options.maxRetries ?? 0;
  if (timeoutMs !== undefined && !isRepresentableTimerDuration(timeoutMs)) throw new ConfigurationError(`timeoutMs must be a positive finite number no greater than ${MAX_TIMER_DURATION_MS}ms`);
  if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new ConfigurationError('maxRetries must be a non-negative integer');
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new ConfigurationError('A fetch implementation is required');
  return { apiKey, baseURL, timeoutMs, maxRetries, fetch: fetchImpl };
}

/** Validate one credential value without ever echoing it (native Headers errors can include it). */
function validateApiKey(value: unknown, missing: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new ConfigurationError(missing);
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new ConfigurationError('The Adeli API key must not contain control characters');
  try { new Headers({ authorization: `Bearer ${value}` }); }
  catch { throw new ConfigurationError('The Adeli API key must be a valid HTTP header value'); }
  return value;
}

/** Call the caller's resolver afresh for each attempt; never cache its result. */
function apiKeyResolver(resolve: () => string | Promise<string>): ApiKeySource {
  return async () => {
    let value: unknown;
    try { value = await resolve(); }
    catch (cause) { throw new ConfigurationError('The Adeli API key resolver failed', { cause }); }
    return validateApiKey(value, 'The Adeli API key resolver must return a non-empty string');
  };
}

export function validateBaseURL(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new ConfigurationError('baseURL must be an absolute URL origin'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new ConfigurationError('baseURL must use http or https');
  if (url.protocol !== 'https:' && !LOCAL_HOSTS.has(url.hostname)) throw new ConfigurationError('HTTPS is required except for local development');
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new ConfigurationError('baseURL must be an origin without a path, query, fragment, or credentials');
  return url.origin;
}
