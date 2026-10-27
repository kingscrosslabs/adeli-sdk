# Client and request semantics

`@adeli/sdk` is a server-only SDK for Node.js 22+. It is not supported in browsers, Bun, Deno, or edge runtimes. Construct `Adeli` only in a caller-invoked server function; module import does not read environment variables or make requests.

```ts
import { Adeli } from '@adeli/sdk';
const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
```

`apiKey` wins over `ADELI_API_KEY`. `baseURL` is an origin (not an origin plus `/api/v1`); production origins must use HTTPS, while HTTP is reserved for explicit local development. `timeoutMs` is a total local deadline and `maxRetries` is opt-in. Timer values must be positive, finite, and no greater than `2_147_483_647` milliseconds (about 24.8 days); larger values are rejected before a request rather than being clamped by Node. The default retry count is zero. With opt-in retries, audited safe reads and profile creation with a stable idempotency key qualify. Daily quota exhaustion, permission/billing/semantic conflicts, and other known non-transient failures are never retried. `listPosts` is conservatively excluded because an X read can be billed; `getXUsage` is a safe read of Adeli's stored usage ledger and does not call X itself, so it is eligible for the ordinary transient-read policy.

## Requests and responses

Resource methods use named `{ path, query, body }` arguments. Paths and query values are encoded by the transport. The SDK preserves the wire body: provider-specific casing such as `contentType` and `content_type`, `null`, privacy/visibility, warnings, and partial records remain unchanged. Every successful call returns `{ data, status, headers }`; `202`, `207`, and `204` are valid success statuses (`204` has `data: undefined`). Collection `status: partial` is still a successful response and contains usable records plus per-account errors.

Most operations require a profile or connected account scope. Organization-wide account listing is distinct from profile-scoped listing. Permissions/capabilities can be partial or nullable; inspect `missingPermissions`, `missingResources`, `capabilities`, and reconnect guidance rather than assuming a connected account can perform every operation. Public connection starts the typed flow but does not replace Facebook Page selection or WhatsApp dashboard Embedded Signup.

## Polling and comment iteration

Polling helpers are explicit bounded workflows: pass both a positive `intervalMs` and positive total `timeoutMs` (each no greater than `2_147_483_647` milliseconds), and optionally an `AbortSignal`. `waitForConnection`, `waitForInstagramPost`, `waitForTikTokPost`, `waitForFacebookPost`, and `waitForYouTubeVideo` return the terminal API response, including provider failure states; they throw only for local timeout, cancellation, or an unfamiliar provider status. Facebook video `READY`/`ERROR` is separate from a connection's `pending_page_selection` dashboard handoff.

```ts
import { waitForYouTubeVideo } from '@adeli/sdk/helpers';

const status = await waitForYouTubeVideo(
  client,
  { query: { accountId, videoId } },
  { intervalMs: 2_000, timeoutMs: 300_000, signal },
);
if (status.data.status === 'failed') throw new Error(status.data.failureReason ?? 'YouTube processing failed');
```

`iterateCommentPages` and `iterateComments` support TikTok and YouTube only. They accept `maxPages` (default `100`, always finite), optional total `timeoutMs` no greater than `2_147_483_647` milliseconds, and optional `signal`; they stop on no cursor, an empty/repeated cursor, or the page limit.

```ts
import { iterateCommentPages } from '@adeli/sdk/helpers';

for await (const page of iterateCommentPages(
  client,
  { query: { platform: 'youtube', accountId } },
  { maxPages: 100, timeoutMs: 60_000, signal },
)) {
  for (const comment of page.data.comments) console.log(comment.id);
  // page.data.complete/syncedAt describe cache freshness, not pagination.
}
```

The iterator pins the first authoritative `postId` when the initial query omitted one and preserves page cache metadata such as `complete`/`syncedAt`; that metadata describes freshness/completeness of the returned page, not whether `nextCursor` exists.

## Deadlines, cancellation, and errors

Pass an `AbortSignal` and/or per-call `timeoutMs` in the second argument. Cancellation stops this client request; it cannot undo work already accepted by Adeli. Polling helpers have a separate total deadline and never fetch a returned OAuth/status URL directly. Treat an aborted write as an ambiguous remote outcome and inspect the provider before resubmitting.

Catch `AdeliApiError` for an HTTP/API response. Its `status`, `code`, `details`, and `headers` are preserved; subclasses include `AuthenticationError`, `ValidationError`, `PermissionRequiredError`, and `RateLimitError`. `ConfigurationError`, `NetworkError`, `TimeoutError`, `CancellationError`, and `MalformedResponseError` represent local/client failures. Do not log API keys, OAuth URLs, media, message bodies, or provider payloads by default.

Error `details` remain `unknown`: validation arrays and provider-specific objects are not interchangeable. Use the exported `isPermissionRequiredDetails(error.details)` guard before reading known permission fields. It accepts sparse reconnect guidance, validates known fields, and leaves unknown extensions untouched. A false result does not invalidate the API error. Even recognized `reconnect.href` values are advisory data, not URLs the SDK will automatically fetch; restart authorization through the typed connection methods with explicit scope.

## Scope and safety

Profile creation accepts an optional idempotency key. Ad-account and campaign creation require keys and do not auto-retry. Publishing has no generic idempotency guarantee. The X usage response is a stored Adeli ledger: `totalCostMicros` and each `operations[].costMicros` are millionths of a US dollar. Preserve these integer values precisely; the SDK does not implicitly convert or round them to dollars. Actual X post/analytics provider calls can incur charges; Ads and destructive calls require separate approval and cleanup planning. The SDK does not claim to enforce every evolving provider-side semantic rule; the API remains authoritative.

## Direct media uploads

Pass `Blob`/`File` values in media fields (including Instagram/Facebook media, TikTok video/photos, YouTube video/thumbnail, X media/thread parts, and Bluesky images/video). The posts resource resolves the profile when necessary, calls `createMediaUploads`, PUTs each raw body to its presigned S3 URL with the returned headers unchanged, and sends only staged references to Adeli. Uploads use concurrency three by default; set `concurrency`, `onProgress`, `signal`, or `timeoutMs` in the method options. Presigned PUTs are idempotent and honor the client's bounded retry count; post publication itself is never retried automatically.

A file-backed Instagram `createPost` returns a `202` job response. Call `client.posts.getInstagramPostStatus(...)` directly or use bounded `waitForInstagramPost(...)`. Its terminal states are `published`, `failed`, and `outcome_unknown`; the last state is intentionally not retried because Meta may already have accepted the final publish write.

Use `client.posts.createMediaUploads(...)` directly when another process manages the PUTs. API keys are sent only to Adeli and never to signed S3 URLs.
