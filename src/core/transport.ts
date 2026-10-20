import { isRepresentableTimerDuration, MAX_TIMER_DURATION_MS } from './duration.js';
import { apiError, CancellationError, MalformedResponseError, NetworkError, RedirectError, TimeoutError } from './errors.js';
import { backoffMs, canRetry, isDailyQuotaExhausted, isRetryableStatus, parseRetryAfter, retryableNetworkError, sleepWithSignal } from './retry.js';
import type { ResolvedConfig } from './config.js';
import type { ApiResponse, MultipartBody, PathParams, QueryParams, QueryValue, TransportRequest } from './types.js';

function isMultipartBody(value: unknown): value is MultipartBody {
  return value !== null && typeof value === 'object' && 'stream' in value && 'contentType' in value
    && typeof (value as { stream?: unknown }).stream === 'object'
    && typeof (value as { contentType?: unknown }).contentType === 'string';
}

function pathSegment(value: string | number, name: string): string {
  const segment = String(value);
  let decoded = segment;
  try { decoded = decodeURIComponent(segment); } catch { /* encode the literal malformed percent sequence */ }
  if (decoded === '.' || decoded === '..') throw new TypeError(`Invalid path parameter ${name}: dot segments are not allowed`);
  return encodeURIComponent(segment);
}

function buildURL(baseURL: string, template: string, path: PathParams | undefined, query: QueryParams | undefined): URL {
  const pathValues = path as Record<string, string | number> | undefined;
  const rendered = template.replace(/\{([^}]+)\}/g, (_whole, name: string) => {
    const value = pathValues?.[name];
    if (value === undefined) throw new TypeError(`Missing path parameter: ${name}`);
    return pathSegment(value, name);
  });
  const url = new URL(`/api/v1${rendered.startsWith('/') ? rendered : `/${rendered}`}`, `${baseURL}/`);
  if (query) for (const [key, value] of Object.entries(query as Record<string, QueryValue>)) {
    if (value === undefined || value === null) continue;
    if (/\u0000|\r|\n/.test(key)) throw new TypeError('Invalid query parameter name');
    for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(item));
  }
  return url;
}

function redact(value: unknown, secret: string): unknown {
  if (typeof value === 'string') return value.split(secret).join('[REDACTED]');
  if (Array.isArray(value)) return value.map((item) => redact(item, secret));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.split(secret).join('[REDACTED]'), redact(item, secret)]));
  }
  return value;
}

async function readResponseText(response: Response, signal: AbortSignal): Promise<string> {
  if (response.status === 204) return '';
  if (signal.aborted) throw new DOMException('aborted', 'AbortError');
  const body = response.body;
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const chunks: string[] = [];
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      callback();
    };
    const onAbort = () => {
      void reader.cancel().catch(() => undefined);
      finish(() => reject(new DOMException('aborted', 'AbortError')));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    const read = async () => {
      try {
        while (!settled) {
          const chunk = await reader.read();
          if (settled) return;
          if (chunk.done) {
            finish(() => resolve(chunks.join('') + decoder.decode()));
            return;
          }
          chunks.push(decoder.decode(chunk.value, { stream: true }));
        }
      } catch (error) {
        finish(() => reject(error));
      }
    };
    void read();
  });
}

export class Transport {
  constructor(private readonly config: ResolvedConfig) {}
  /** Prevent client configuration, especially apiKey, from leaking through JSON serialization. */
  toJSON(): Record<string, never> { return {}; }

  async request<T, B = unknown>(request: TransportRequest<B>): Promise<ApiResponse<T>> {
    const timeoutMs = request.timeoutMs ?? this.config.timeoutMs ?? request.operation.defaultTimeoutMs ?? 60_000;
    if (!isRepresentableTimerDuration(timeoutMs)) throw new TypeError(`timeoutMs must be a positive finite number no greater than ${MAX_TIMER_DURATION_MS}ms`);
    if (request.idempotencyKey !== undefined && (request.idempotencyKey.trim() === '' || /[\u0000-\u001f\u007f\r\n]/.test(request.idempotencyKey))) {
      throw new TypeError('idempotencyKey must be a nonblank valid HTTP header value');
    }
    if (request.signal?.aborted) throw new CancellationError('The Adeli request was cancelled');
    const deadline = Date.now() + timeoutMs;
    const controller = new AbortController();
    let timedOut = false;
    let cancelled = false;
    const onAbort = () => { cancelled = true; controller.abort(); };
    request.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const maxAttempts = canRetry(request.operation, request.idempotencyKey) ? this.config.maxRetries + 1 : 1;
      let attempt = 0;
      while (true) {
        try {
          const response = await this.perform(request, controller.signal);
          if (response.ok) return { data: response.data as T, status: response.status, headers: response.headers };
          if (attempt + 1 < maxAttempts && isRetryableStatus(response.status) && !isDailyQuotaExhausted(response.error.code) && Date.now() < deadline) {
            const delay = backoffMs(attempt, parseRetryAfter(response.headers.get('retry-after')));
            if (Date.now() + delay >= deadline) throw response.error;
            await sleepWithSignal(delay, controller.signal);
            attempt++;
            continue;
          }
          throw response.error;
        } catch (error) {
          if (timedOut) throw new TimeoutError(`Adeli request exceeded its ${timeoutMs}ms deadline; the remote write outcome may be unknown`);
          if (cancelled) throw new CancellationError('The Adeli request was cancelled');
          if (error instanceof Error && error.name === 'AbortError') throw new CancellationError('The Adeli request was cancelled');
          if (attempt + 1 < maxAttempts && retryableNetworkError(error) && Date.now() < deadline) {
            const delay = backoffMs(attempt);
            if (Date.now() + delay >= deadline) throw error;
            await sleepWithSignal(delay, controller.signal);
            attempt++;
            continue;
          }
          throw error;
        }
      }
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
    }
  }

  private async perform<B>(request: TransportRequest<B>, signal: AbortSignal): Promise<{ ok: true; data: unknown; status: number; headers: Headers } | { ok: false; data: undefined; status: number; headers: Headers; error: ReturnType<typeof apiError> }> {
    const url = buildURL(this.config.baseURL, request.operation.path, request.path, request.query);
    const headers = new Headers({ authorization: `Bearer ${this.config.apiKey}`, accept: 'application/json' });
    let encodedBody: BodyInit | undefined;
    let duplex: 'half' | undefined;
    if (request.body !== undefined) {
      if (isMultipartBody(request.body)) {
        encodedBody = request.body.stream;
        headers.set('content-type', request.body.contentType);
        duplex = 'half';
      } else if (typeof FormData !== 'undefined' && request.body instanceof FormData) encodedBody = request.body;
      else if (typeof Blob !== 'undefined' && request.body instanceof Blob) encodedBody = request.body;
      else {
        headers.set('content-type', 'application/json');
        encodedBody = JSON.stringify(request.body);
      }
    }
    if (request.idempotencyKey !== undefined) headers.set('idempotency-key', request.idempotencyKey);
    let response: Response;
    try {
      response = await this.config.fetch(url, { method: request.operation.method, headers, signal, redirect: 'error', ...(encodedBody === undefined ? {} : { body: encodedBody }), ...(duplex === undefined ? {} : { duplex }) });
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      throw new NetworkError('Unable to connect to Adeli');
    }
    if (response.redirected) throw new RedirectError('Adeli refused a redirect');
    let text: string;
    try {
      text = await readResponseText(response, signal);
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      throw new NetworkError('Unable to read the Adeli response');
    }
    let data: unknown;
    if (response.status !== 204) {
      if (text === '') {
        if (response.ok) throw new MalformedResponseError('Adeli returned an empty response where JSON was required');
      } else {
        try { data = JSON.parse(text); }
        catch {
          if (response.ok) throw new MalformedResponseError('Adeli returned malformed JSON');
          data = text;
        }
      }
    }
    if (!response.ok) {
      const envelope = data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>).error : undefined;
      const errorBody = envelope !== null && typeof envelope === 'object' && !Array.isArray(envelope) ? envelope as Record<string, unknown> : undefined;
      const code = typeof errorBody?.code === 'string' ? errorBody.code : undefined;
      const redactedCode = code === undefined ? undefined : String(redact(code, this.config.apiKey));
      const message = typeof errorBody?.message === 'string' ? errorBody.message : `Adeli request failed with status ${response.status}`;
      const hasDetails = errorBody !== undefined && Object.prototype.hasOwnProperty.call(errorBody, 'details');
      const details = hasDetails ? errorBody.details : redact(data, this.config.apiKey);
      return {
        ok: false, data: undefined, status: response.status, headers: response.headers,
        error: apiError(String(redact(message, this.config.apiKey)), { status: response.status, details: redact(details, this.config.apiKey), headers: response.headers, ...(redactedCode === undefined ? {} : { code: redactedCode }) }),
      };
    }
    return { ok: true, data: response.status === 204 ? undefined : data, status: response.status, headers: response.headers };
  }
}
