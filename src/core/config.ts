import { isRepresentableTimerDuration, MAX_TIMER_DURATION_MS } from './duration.js';
import { ConfigurationError } from './errors.js';
import type { ClientOptions, Fetch } from './types.js';

export interface ResolvedConfig { readonly apiKey: string; readonly baseURL: string; /** Undefined means use the operation's default, then 60 seconds. */ readonly timeoutMs: number | undefined; readonly maxRetries: number; readonly fetch: Fetch; }
const DEFAULT_BASE_URL = 'https://app.tryadeli.com';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function resolveConfig(options: ClientOptions = {}): ResolvedConfig {
  if (typeof window !== 'undefined') throw new ConfigurationError('Adeli is a server-side SDK and cannot run in a browser');
  const apiKey = options.apiKey ?? process.env.ADELI_API_KEY;
  if (!apiKey || apiKey.trim() === '') throw new ConfigurationError('An Adeli API key is required (pass apiKey or set ADELI_API_KEY)');
  if (/[\u0000-\u001f\u007f]/.test(apiKey)) throw new ConfigurationError('The Adeli API key must not contain control characters');
  // Native Headers errors can echo invalid credential values (for example NUL).
  // Validate locally and discard the original exception rather than leaking it.
  try { new Headers({ authorization: `Bearer ${apiKey}` }); }
  catch { throw new ConfigurationError('The Adeli API key must be a valid HTTP header value'); }
  const baseURL = validateBaseURL(options.baseURL ?? DEFAULT_BASE_URL);
  const timeoutMs = options.timeoutMs;
  const maxRetries = options.maxRetries ?? 0;
  if (timeoutMs !== undefined && !isRepresentableTimerDuration(timeoutMs)) throw new ConfigurationError(`timeoutMs must be a positive finite number no greater than ${MAX_TIMER_DURATION_MS}ms`);
  if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new ConfigurationError('maxRetries must be a non-negative integer');
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new ConfigurationError('A fetch implementation is required');
  return { apiKey, baseURL, timeoutMs, maxRetries, fetch: fetchImpl };
}

export function validateBaseURL(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new ConfigurationError('baseURL must be an absolute URL origin'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new ConfigurationError('baseURL must use http or https');
  if (url.protocol !== 'https:' && !LOCAL_HOSTS.has(url.hostname)) throw new ConfigurationError('HTTPS is required except for local development');
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new ConfigurationError('baseURL must be an origin without a path, query, fragment, or credentials');
  return url.origin;
}
