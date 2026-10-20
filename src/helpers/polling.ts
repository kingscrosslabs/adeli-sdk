import { CancellationError, MalformedResponseError, TimeoutError } from '@adeli/sdk';
import { isRepresentableTimerDuration, MAX_TIMER_DURATION_MS } from '../core/duration.js';
import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { ConnectionSession, ProfilePath } from '../resources/profiles.js';
import type {
  FacebookPostStatusResponse,
  TikTokPostStatusResponse,
  YouTubeVideoStatusResponse,
} from '../resources/posts.js';

type PublishStatusQuery = { readonly accountId: string; readonly profileId?: string; readonly publishId: string };
type VideoStatusQuery = { readonly accountId: string; readonly profileId?: string; readonly videoId: string };

/** A bounded polling deadline and delay. Both values are required to make the side effect explicit. */
export interface PollingOptions {
  readonly timeoutMs: number;
  readonly intervalMs: number;
  readonly signal?: AbortSignal;
}

type ConnectionMethod = (args: { readonly path: ProfilePath & { readonly connectionSessionId: string } }, options?: RequestOptions) => Promise<ApiResponse<ConnectionSession>>;
export type ConnectionPollingClient =
  | { readonly profiles: { readonly getConnection: ConnectionMethod } }
  | { readonly getConnection: ConnectionMethod };

type TikTokMethod = (args: { readonly query: PublishStatusQuery }, options?: RequestOptions) => Promise<ApiResponse<TikTokPostStatusResponse>>;
type FacebookMethod = (args: { readonly query: PublishStatusQuery }, options?: RequestOptions) => Promise<ApiResponse<FacebookPostStatusResponse>>;
type YouTubeMethod = (args: { readonly query: VideoStatusQuery }, options?: RequestOptions) => Promise<ApiResponse<YouTubeVideoStatusResponse>>;
export type TikTokPollingClient = { readonly posts: { readonly getTikTokPostStatus: TikTokMethod } } | { readonly getTikTokPostStatus: TikTokMethod };
export type FacebookPollingClient = { readonly posts: { readonly getFacebookPostStatus: FacebookMethod } } | { readonly getFacebookPostStatus: FacebookMethod };
export type YouTubePollingClient = { readonly posts: { readonly getYouTubeVideoStatus: YouTubeMethod } } | { readonly getYouTubeVideoStatus: YouTubeMethod };
/** A convenience structural type for clients that expose all three status methods under resources. */
export type PostPollingClient = { readonly posts: { readonly getTikTokPostStatus: TikTokMethod; readonly getFacebookPostStatus: FacebookMethod; readonly getYouTubeVideoStatus: YouTubeMethod } };

interface Deadline {
  readonly at: number;
}

type PendingStatus<T> = (response: ApiResponse<T>) => 'pending' | 'terminal' | 'invalid';

function validatePollingOptions(options: PollingOptions): void {
  if (!isRepresentableTimerDuration(options.timeoutMs)) {
    throw new RangeError(`timeoutMs must be a positive finite number no greater than ${MAX_TIMER_DURATION_MS}ms`);
  }
  if (!isRepresentableTimerDuration(options.intervalMs)) {
    throw new RangeError(`intervalMs must be a positive finite number no greater than ${MAX_TIMER_DURATION_MS}ms`);
  }
}

function cancellation(): CancellationError {
  return new CancellationError('The helper operation was cancelled');
}

function timeout(): TimeoutError {
  return new TimeoutError('The helper operation exceeded its total timeout');
}

function protocolError(message: string): MalformedResponseError {
  return new MalformedResponseError(message);
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw cancellation();
}

/**
 * Races a request even when a structural fake client ignores AbortSignal. The
 * request's eventual result is observed so a late rejection cannot become
 * unhandled after the helper has timed out or been cancelled.
 */
async function requestWithDeadline<T>(
  request: (signal: AbortSignal) => Promise<ApiResponse<T>>,
  deadline: Deadline,
  callerSignal: AbortSignal | undefined,
): Promise<ApiResponse<T>> {
  assertNotAborted(callerSignal);
  const remaining = deadline.at - Date.now();
  if (remaining <= 0) throw timeout();

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  let onAbort: (() => void) | undefined;
  const outcome = new Promise<ApiResponse<T>>((resolve, reject) => {
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      if (onAbort !== undefined) callerSignal?.removeEventListener('abort', onAbort);
      action();
    };
    onAbort = () => {
      controller.abort();
      finish(() => reject(cancellation()));
    };
    callerSignal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      finish(() => reject(timeout()));
    }, remaining);

    let result: Promise<ApiResponse<T>>;
    try {
      result = Promise.resolve(request(controller.signal));
    } catch (error) {
      finish(() => reject(error));
      return;
    }
    result.then(
      value => finish(() => {
        if (callerSignal?.aborted) reject(cancellation());
        else if (Date.now() >= deadline.at) reject(timeout());
        else resolve(value);
      }),
      error => finish(() => {
        if (callerSignal?.aborted) reject(cancellation());
        else if (Date.now() >= deadline.at) reject(timeout());
        else reject(error);
      }),
    );
  });
  return outcome;
}

async function sleepUntil(deadline: Deadline, intervalMs: number, signal: AbortSignal | undefined): Promise<void> {
  assertNotAborted(signal);
  const remaining = deadline.at - Date.now();
  if (remaining <= 0) throw timeout();
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const delay = Math.min(intervalMs, remaining);
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      finish(() => {
        if (deadline.at - Date.now() <= 0) reject(timeout());
        else resolve();
      });
    }, delay);
    const onAbort = (): void => finish(() => reject(cancellation()));
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      action();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function poll<T>(
  fetchStatus: (signal: AbortSignal) => Promise<ApiResponse<T>>,
  status: PendingStatus<T>,
  options: PollingOptions,
): Promise<ApiResponse<T>> {
  validatePollingOptions(options);
  assertNotAborted(options.signal);
  const deadline = { at: Date.now() + options.timeoutMs };
  while (true) {
    const response = await requestWithDeadline(fetchStatus, deadline, options.signal);
    assertNotAborted(options.signal);
    if (Date.now() >= deadline.at) throw timeout();
    const state = status(response);
    if (state === 'terminal') return response;
    if (state === 'invalid') throw protocolError('The provider returned an unknown polling status');
    await sleepUntil(deadline, options.intervalMs, options.signal);
  }
}

function connectionStatus(response: ApiResponse<ConnectionSession>): 'pending' | 'terminal' | 'invalid' {
  const value = response.data?.status as string | undefined;
  switch (value) {
    case 'pending_authorization':
    case 'processing':
    case 'pending_page_selection':
      return 'pending';
    case 'connected':
    case 'failed':
    case 'expired':
      return 'terminal';
    default:
      return 'invalid';
  }
}

function facebookStatus(response: ApiResponse<FacebookPostStatusResponse>): 'pending' | 'terminal' | 'invalid' {
  switch (response.data?.status) {
    case 'PROCESSING': return 'pending';
    case 'READY':
    case 'ERROR': return 'terminal';
    default: return 'invalid';
  }
}

function youtubeStatus(response: ApiResponse<YouTubeVideoStatusResponse>): 'pending' | 'terminal' | 'invalid' {
  switch (response.data?.status) {
    case 'processing': return 'pending';
    case 'published':
    case 'failed': return 'terminal';
    default: return 'invalid';
  }
}

function tiktokStatus(response: ApiResponse<TikTokPostStatusResponse>): 'pending' | 'terminal' | 'invalid' {
  switch (response.data?.status) {
    // TikTok may report upload/download processing before delivery to the inbox.
    case 'PROCESSING_UPLOAD':
    case 'PROCESSING_DOWNLOAD': return 'pending';
    // Inbox delivery is terminal, but it is not public publication.
    case 'SEND_TO_USER_INBOX':
    case 'PUBLISH_COMPLETE':
    case 'FAILED': return 'terminal';
    default: return 'invalid';
  }
}

function connectionMethod(client: ConnectionPollingClient): ConnectionMethod {
  return 'profiles' in client
    ? (args, options) => client.profiles.getConnection(args, options)
    : (args, options) => client.getConnection(args, options);
}
function tikTokMethod(client: TikTokPollingClient): TikTokMethod {
  return 'posts' in client
    ? (args, options) => client.posts.getTikTokPostStatus(args, options)
    : (args, options) => client.getTikTokPostStatus(args, options);
}
function facebookMethod(client: FacebookPollingClient): FacebookMethod {
  return 'posts' in client
    ? (args, options) => client.posts.getFacebookPostStatus(args, options)
    : (args, options) => client.getFacebookPostStatus(args, options);
}
function youtubeMethod(client: YouTubePollingClient): YouTubeMethod {
  return 'posts' in client
    ? (args, options) => client.posts.getYouTubeVideoStatus(args, options)
    : (args, options) => client.getYouTubeVideoStatus(args, options);
}

/** Poll a typed connection session; Facebook Page selection can require a dashboard handoff. */
export function waitForConnection(
  client: ConnectionPollingClient,
  args: { readonly path: ProfilePath & { readonly connectionSessionId: string } },
  options: PollingOptions,
): Promise<ApiResponse<ConnectionSession>> {
  const getConnection = connectionMethod(client);
  const snapshot = { path: { ...args.path } };
  return poll(signal => getConnection(snapshot, { signal }), connectionStatus, options);
}

/** Poll TikTok processing. SEND_TO_USER_INBOX is not a public publication. */
export function waitForTikTokPost(
  client: TikTokPollingClient,
  args: { readonly query: PublishStatusQuery },
  options: PollingOptions,
): Promise<ApiResponse<TikTokPostStatusResponse>> {
  const getStatus = tikTokMethod(client);
  const snapshot = { query: { ...args.query } };
  return poll(signal => getStatus(snapshot, { signal }), tiktokStatus, options);
}

/** Poll Facebook video processing; Page selection is outside this status endpoint. */
export function waitForFacebookPost(
  client: FacebookPollingClient,
  args: { readonly query: PublishStatusQuery },
  options: PollingOptions,
): Promise<ApiResponse<FacebookPostStatusResponse>> {
  const getStatus = facebookMethod(client);
  const snapshot = { query: { ...args.query } };
  return poll(signal => getStatus(snapshot, { signal }), facebookStatus, options);
}

/** Poll YouTube processing. Published means processing completed, not public visibility. */
export function waitForYouTubeVideo(
  client: YouTubePollingClient,
  args: { readonly query: VideoStatusQuery },
  options: PollingOptions,
): Promise<ApiResponse<YouTubeVideoStatusResponse>> {
  const getStatus = youtubeMethod(client);
  const snapshot = { query: { ...args.query } };
  return poll(signal => getStatus(snapshot, { signal }), youtubeStatus, options);
}
