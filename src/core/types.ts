export type Fetch = typeof globalThis.fetch;

export interface ApiResponse<T> {
  /** A successful 204 response has no body and therefore returns undefined. */
  data: T;
  status: number;
  headers: Headers;
}

/** Options local to this SDK call; request input always belongs in the first argument. */
export interface RequestOptions {
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
}

/** Internal transport accepts structurally typed path/query objects; public resource types name every field. */
/** Internal request maps; public operation methods provide named object types. */
export type PathParams = object;
export type QueryValue = string | number | boolean | readonly (string | number | boolean)[] | null | undefined;
export type QueryParams = object;

/** A streaming multipart body with a serializer-owned boundary and no eager buffering. */
export interface MultipartBody {
  readonly stream: ReadableStream<Uint8Array>;
  readonly contentType: string;
}

export interface OperationOptions<P extends PathParams = PathParams, Q extends QueryParams = QueryParams, B = never> {
  path?: P | undefined;
  query?: Q | undefined;
  body?: B | undefined;
}

/**
 * Returns the Adeli API key for one outbound request. The SDK calls it on every
 * request attempt, retries included, and never caches the result, so a rotated
 * key is picked up on the next attempt.
 */
export type ApiKeyResolver = () => string | Promise<string>;
/** A static Adeli API key, or a resolver called before every request attempt. */
export type ApiKey = string | ApiKeyResolver;

export interface ClientOptions {
  /** A static key is validated at construction; a resolver's result is validated on every attempt. Falls back to `ADELI_API_KEY`. */
  apiKey?: ApiKey | undefined;
  baseURL?: string | undefined;
  timeoutMs?: number | undefined;
  maxRetries?: number | undefined;
  fetch?: Fetch | undefined;
}

/** `profile-create` and `idempotent-write` retry only when the caller supplies a stable idempotency key. */
export type RetryClass = 'never' | 'safe-read' | 'profile-create' | 'idempotent-write';
export interface OperationMetadata {
  readonly operationId: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly retry: RetryClass;
  /** Operation-level fallback (for example, uploads); explicit call/client timeouts take precedence. */
  readonly defaultTimeoutMs?: number;
}

export interface TransportRequest<B = unknown> extends RequestOptions {
  readonly operation: OperationMetadata;
  readonly path?: PathParams | undefined;
  readonly query?: QueryParams | undefined;
  readonly body?: B | MultipartBody | undefined;
  readonly idempotencyKey?: string | undefined;
}
