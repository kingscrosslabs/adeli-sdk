import { CancellationError, NetworkError, RedirectError } from './errors.js';
import type { OperationMetadata } from './types.js';

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
export function isRetryableStatus(status: number): boolean { return TRANSIENT_STATUSES.has(status); }
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}
export function canRetry(operation: OperationMetadata, idempotencyKey: string | undefined): boolean {
  return operation.retry === 'safe-read'
    || (operation.retry === 'profile-create' && idempotencyKey !== undefined && idempotencyKey.trim() !== '');
}
export function backoffMs(attempt: number, retryAfter?: number, random = Math.random()): number {
  if (retryAfter !== undefined) return retryAfter;
  return Math.min(30_000, 250 * (2 ** attempt)) + Math.floor(random * 100);
}
export async function sleepWithSignal(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new CancellationError('The Adeli request was cancelled');
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(new CancellationError('The Adeli request was cancelled')));
    const timer = setTimeout(() => finish(resolve), ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
/** Only failures explicitly wrapped after fetch rejection are retryable network errors. */
export function retryableNetworkError(error: unknown): boolean {
  return error instanceof NetworkError && !(error instanceof RedirectError);
}
export function isDailyQuotaExhausted(code: string): boolean {
  const normalized = code.toLowerCase().replace(/[-\s]/g, '_');
  return normalized === 'quota_exhausted'
    || normalized === 'daily_quota_exceeded'
    || (normalized.includes('daily') && normalized.includes('quota'));
}
