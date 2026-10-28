import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigurationError, MalformedResponseError } from '@adeli/sdk';

/** The raw request body exactly as received. Verify before parsing; re-serialized JSON will not match. */
export type WebhookPayload = string | Uint8Array;

export interface VerifyWebhookSignatureInput {
  /** The raw request body. */
  readonly payload: WebhookPayload;
  /** The `Adeli-Signature` header: `t=<unix seconds>,v1=<hex HMAC-SHA256>`. */
  readonly header: string | null | undefined;
  /** The webhook's signing secret, returned once by `createWebhook`. */
  readonly secret: string;
  /** Maximum age (or clock skew) of the signed timestamp. Defaults to 300 seconds. */
  readonly toleranceSeconds?: number;
  /** Current time in unix seconds, for tests. Defaults to the system clock. */
  readonly now?: number;
}

export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Check an `Adeli-Signature` header against the raw body. Returns false for a
 * malformed header, a timestamp outside the tolerance, or a signature mismatch;
 * the comparison is constant-time. Throws only for a missing secret or an
 * invalid tolerance, which are configuration mistakes rather than bad deliveries.
 */
export function verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean {
  if (typeof input.secret !== 'string' || input.secret.length === 0) throw new ConfigurationError('verifyWebhookSignature requires the webhook signing secret');
  const tolerance = input.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new ConfigurationError('toleranceSeconds must be a finite, non-negative number');
  const parsed = parseSignatureHeader(input.header);
  if (!parsed) return false;
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > tolerance) return false;
  const expected = createHmac('sha256', input.secret).update(`${parsed.timestamp}.`).update(input.payload).digest();
  return timingSafeEqual(expected, Buffer.from(parsed.signature, 'hex'));
}

function parseSignatureHeader(header: string | null | undefined): { timestamp: number; signature: string } | undefined {
  if (typeof header !== 'string') return undefined;
  const fields = new Map<string, string>();
  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator <= 0) return undefined;
    const key = part.slice(0, separator).trim();
    if (fields.has(key)) return undefined;
    fields.set(key, part.slice(separator + 1).trim());
  }
  const timestamp = fields.get('t');
  const signature = fields.get('v1');
  if (timestamp === undefined || !/^\d{1,12}$/.test(timestamp)) return undefined;
  if (signature === undefined || !/^[0-9a-f]{64}$/.test(signature)) return undefined;
  return { timestamp: Number(timestamp), signature };
}

interface WebhookEventEnvelope {
  /** Stable per provider event; deduplicate redeliveries on it. */
  readonly id: string;
  readonly createdAt: string;
  readonly profileId: string;
  readonly accountId: string;
}

export interface CommentCreatedEvent extends WebhookEventEnvelope {
  readonly type: 'comment.created';
  readonly platform: 'instagram';
  readonly data: {
    readonly commentId: string;
    readonly mediaId: string;
    readonly parentId: string | null;
    readonly text: string;
    readonly from: { readonly id: string | null; readonly username: string | null };
    /** True when the connected account wrote the comment itself. */
    readonly isSelf: boolean;
  };
}

export interface MessagePostbackEvent extends WebhookEventEnvelope {
  readonly type: 'message.postback';
  readonly platform: 'instagram';
  readonly data: {
    /** The person's Instagram-scoped id; reply with `sendInstagramMessage({ recipient: { id: senderId } })`. */
    readonly senderId: string;
    readonly payload: string;
    readonly title: string | null;
    readonly messageId: string | null;
  };
}

/** An event type (or platform) this SDK version does not know yet. `eventType` keeps the wire `type`. */
export interface UnknownWebhookEvent extends WebhookEventEnvelope {
  readonly type: 'unknown';
  readonly eventType: string;
  readonly platform: string;
  readonly data: unknown;
}

export type WebhookEvent = CommentCreatedEvent | MessagePostbackEvent | UnknownWebhookEvent;
export type WebhookEventType = Exclude<WebhookEvent['type'], 'unknown'>;

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';

function malformed(detail: string): never {
  throw new MalformedResponseError(`Malformed webhook event: ${detail}`);
}

function requireString(record: JsonRecord, key: string, where: string): string {
  const value = record[key];
  if (typeof value !== 'string') malformed(`${where}.${key} must be a string`);
  return value;
}

function requireNullableString(record: JsonRecord, key: string, where: string): string | null {
  const value = record[key];
  if (!isNullableString(value)) malformed(`${where}.${key} must be a string or null`);
  return value;
}

/**
 * Parse a verified webhook body into a typed event. Known types are validated
 * field by field; an unrecognised type parses as `type: 'unknown'` so new event
 * types stay additive. Throws `MalformedResponseError` for invalid JSON, a
 * missing envelope field, or a known event whose data does not match.
 */
export function parseWebhookEvent(payload: WebhookPayload): WebhookEvent {
  let text: string;
  try { text = typeof payload === 'string' ? payload : new TextDecoder('utf-8', { fatal: true }).decode(payload); }
  catch { malformed('body is not valid UTF-8'); }
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { malformed('body is not valid JSON'); }
  if (!isRecord(value)) malformed('body must be a JSON object');
  const envelope = {
    id: requireString(value, 'id', 'event'),
    createdAt: requireString(value, 'createdAt', 'event'),
    profileId: requireString(value, 'profileId', 'event'),
    accountId: requireString(value, 'accountId', 'event'),
  };
  const type = requireString(value, 'type', 'event');
  const platform = requireString(value, 'platform', 'event');
  const data = value.data;
  if (platform === 'instagram' && type === 'comment.created') {
    if (!isRecord(data)) malformed('data must be an object');
    const from = data.from;
    if (!isRecord(from)) malformed('data.from must be an object');
    if (typeof data.isSelf !== 'boolean') malformed('data.isSelf must be a boolean');
    return { ...envelope, type, platform, data: {
      commentId: requireString(data, 'commentId', 'data'),
      mediaId: requireString(data, 'mediaId', 'data'),
      parentId: requireNullableString(data, 'parentId', 'data'),
      text: requireString(data, 'text', 'data'),
      from: { id: requireNullableString(from, 'id', 'data.from'), username: requireNullableString(from, 'username', 'data.from') },
      isSelf: data.isSelf,
    } };
  }
  if (platform === 'instagram' && type === 'message.postback') {
    if (!isRecord(data)) malformed('data must be an object');
    return { ...envelope, type, platform, data: {
      senderId: requireString(data, 'senderId', 'data'),
      payload: requireString(data, 'payload', 'data'),
      title: requireNullableString(data, 'title', 'data'),
      messageId: requireNullableString(data, 'messageId', 'data'),
    } };
  }
  return { ...envelope, type: 'unknown', eventType: type, platform, data };
}
