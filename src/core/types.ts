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

export interface ClientOptions {
  apiKey?: string | undefined;
  baseURL?: string | undefined;
  timeoutMs?: number | undefined;
  maxRetries?: number | undefined;
  fetch?: Fetch | undefined;
}

export type RetryClass = 'never' | 'safe-read' | 'profile-create';
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
