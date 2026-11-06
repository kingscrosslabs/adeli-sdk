import { CancellationError, ConfigurationError, MalformedResponseError, TimeoutError } from '@adeli/sdk';
import { isRepresentableTimerDuration, MAX_TIMER_DURATION_MS } from '../core/duration.js';
import type { ApiResponse, RequestOptions } from '../core/types.js';

/** Options shared by the bounded page iterators. */
export interface PageIteratorOptions {
  /** Maximum number of requests. The default is deliberately finite. */
  readonly maxPages?: number;
  /** Total wall-clock budget for all pages, including request time. */
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

const DEFAULT_MAX_PAGES = 100;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function validateOptions(options: PageIteratorOptions): Required<Pick<PageIteratorOptions, 'maxPages'>> & PageIteratorOptions {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  if (!Number.isFinite(maxPages) || maxPages <= 0 || !Number.isInteger(maxPages)) {
    throw new ConfigurationError('maxPages must be a finite positive integer');
  }
  if (options.timeoutMs !== undefined && !isRepresentableTimerDuration(options.timeoutMs)) {
    throw new ConfigurationError(`timeoutMs must be a positive finite number no greater than ${MAX_TIMER_DURATION_MS}ms`);
  }
  return { ...options, maxPages };
}

export function abortError(): CancellationError {
  return new CancellationError('The helper operation was cancelled');
}

export function timeoutError(): TimeoutError {
  return new TimeoutError('The helper operation exceeded its total timeout');
}

export function malformed(message: string): MalformedResponseError {
  return new MalformedResponseError(message);
}

export function makeDeadline(timeoutMs: number | undefined): number | undefined {
  return timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
}

/** Run one page request inside the iterator's total deadline and caller signal. */
export async function requestPage<T>(
  call: (options: RequestOptions) => Promise<ApiResponse<T>>,
  deadline: number | undefined,
  signal: AbortSignal | undefined,
): Promise<ApiResponse<T>> {
  if (signal?.aborted) throw abortError();
  const remaining = deadline === undefined ? undefined : deadline - Date.now();
  if (remaining !== undefined && remaining <= 0) throw timeoutError();

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  let onAbort: (() => void) | undefined;
  return new Promise<ApiResponse<T>>((resolve, reject) => {
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      if (onAbort !== undefined) signal?.removeEventListener('abort', onAbort);
      action();
    };
    onAbort = () => {
      controller.abort();
      finish(() => reject(abortError()));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (remaining !== undefined) {
      timer = setTimeout(() => {
        controller.abort();
        finish(() => reject(timeoutError()));
      }, remaining);
    }
    let result: Promise<ApiResponse<T>>;
    try {
      result = Promise.resolve(call({ signal: controller.signal }));
    } catch (error) {
      finish(() => reject(error));
      return;
    }
    result.then(
      value => finish(() => {
        if (signal?.aborted) reject(abortError());
        else if (deadline !== undefined && Date.now() >= deadline) reject(timeoutError());
        else resolve(value);
      }),
      error => finish(() => {
        if (signal?.aborted) reject(abortError());
        else if (deadline !== undefined && Date.now() >= deadline) reject(timeoutError());
        else reject(error);
      }),
    );
  });
}
