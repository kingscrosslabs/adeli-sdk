<p align="center">
  <img src="https://raw.githubusercontent.com/kingscrosslabs/adeli-sdk/main/.github/assets/logo.svg" width="120" height="120" alt="Adeli logo" />
  <h1 align="center">Adeli SDK</h1>
  <p align="center">
    The official TypeScript SDK for <a href="https://www.tryadeli.com">Adeli</a>, the unified social media and ads API.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@adeli/sdk"><img src="https://img.shields.io/npm/v/@adeli/sdk?color=0a807a&label=npm" alt="npm version" /></a>
  <a href="https://github.com/kingscrosslabs/adeli-sdk/actions/workflows/ci.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/kingscrosslabs/adeli-sdk/ci.yml?branch=main&label=CI" alt="CI status" /></a>
  <a href="https://github.com/kingscrosslabs/adeli-sdk/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@adeli/sdk?color=0a807a" alt="MIT license" /></a>
  <img src="https://img.shields.io/node/v/@adeli/sdk?color=339933&logo=nodedotjs&logoColor=white" alt="Node.js version" />
  <img src="https://img.shields.io/badge/types-included-3178c6?logo=typescript&logoColor=white" alt="TypeScript types included" />
</p>

<p align="center">
  <a href="https://github.com/kingscrosslabs/adeli-sdk/blob/main/docs/client.md">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://www.tryadeli.com/docs/api">API reference</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/kingscrosslabs/adeli-sdk/blob/main/docs/publishing.md">Publishing guide</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/kingscrosslabs/adeli-sdk/tree/main/examples">Examples</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/kingscrosslabs/adeli-sdk/blob/main/CHANGELOG.md">Changelog</a>
</p>

<br />

## Introduction

The Adeli SDK is a TypeScript client for the [Adeli API](https://www.tryadeli.com). Create the `adeli` object to post on social media, read or reply to comments and messages, analyze account insights, or manage ads.

```ts
import { Adeli } from '@adeli/sdk';

const adeli = new Adeli(); // reads ADELI_API_KEY

// publish
await adeli.posts.createPost({
  body: { platform: 'x', accountId, text: 'Shipped with @adeli/sdk 🚀' },
});

// read
const { data } = await adeli.accounts.listAccounts();
data.accounts; // every connected account, fully typed
```

- Types generated from the Adeli OpenAPI contract
- Zero runtime dependencies, with ESM and CommonJS builds
- Runs on Node.js 22+, Vercel functions, and Cloudflare Workers
- Media uploads that stream straight to storage
- Bounded polling, comment iterators, and webhook verification
- No retries unless you opt in, and a typed error class for each failure

## Installation

```sh
npm install @adeli/sdk
```

```sh
export ADELI_API_KEY="..." # from https://app.tryadeli.com
```

Your API key is a secret. Create the client only in server code, and never expose the key through a `NEXT_PUBLIC_` or `VITE_` env var. On Cloudflare Workers without `nodejs_compat`, pass `apiKey` explicitly.

## Basic usage

Every call resolves to `{ data, status, headers }`.

```ts
const { data } = await adeli.profiles.listProfiles();
//      ^? { profiles: Profile[] }
```

The client is grouped by resource: `profiles`, `accounts`, `posts`, `comments`, `messages`, `analytics`, `ads`, `webhooks`, and `usage`.

### Connect an account

```ts
import { waitForConnection } from '@adeli/sdk/helpers';

const session = await adeli.profiles.startConnection({
  path: { profileId },
  body: { platform: 'tiktok', redirectUrl: 'https://example.com/connected' },
});

// send the user to session.data.authUrl, then:
await waitForConnection(
  adeli,
  { path: { profileId, connectionSessionId: session.data.id } },
  { intervalMs: 2_000, timeoutMs: 300_000 },
);
```

### Upload a video

```ts
import { fileFromPath } from '@adeli/sdk/uploads';

await adeli.posts.createPost({
  body: {
    platform: 'tiktok',
    accountId,
    video: await fileFromPath('./launch.mp4', { contentType: 'video/mp4' }),
    music_usage_confirmed: true,
  },
});
```

`fileFromPath` is for Node.js. You can pass any `Blob` or `File` as media in any runtime.

### Iterate comments

```ts
import { iterateComments } from '@adeli/sdk/helpers';

for await (const comment of iterateComments(
  adeli,
  { query: { platform: 'youtube', accountId } },
  { maxPages: 10, timeoutMs: 60_000 },
)) {
  console.log(comment.id);
}
```

### Verify webhooks

```ts
import { parseWebhookEvent, verifyWebhookSignature } from '@adeli/sdk/helpers';

export async function POST(request: Request) {
  const payload = await request.text();
  const valid = verifyWebhookSignature({
    payload,
    header: request.headers.get('Adeli-Signature'),
    secret: process.env.ADELI_WEBHOOK_SECRET!,
  });
  if (!valid) return new Response('Invalid signature', { status: 401 });

  const event = parseWebhookEvent(payload);
  if (event.type === 'comment.created') {
    // ...
  }
  return new Response(null, { status: 204 });
}
```

### Handle errors

```ts
import { AdeliApiError, PermissionRequiredError, RateLimitError, TimeoutError } from '@adeli/sdk';

try {
  await adeli.posts.createPost({ body });
} catch (error) {
  if (error instanceof PermissionRequiredError) {
    // reconnect the account with more permissions
  } else if (error instanceof RateLimitError) {
    // back off
  } else if (error instanceof TimeoutError) {
    // outcome unknown: check before you send it again
  } else if (error instanceof AdeliApiError) {
    console.error(error.status, error.code, error.details);
  }
}
```

See [`examples/`](https://github.com/kingscrosslabs/adeli-sdk/tree/main/examples) for complete, type-checked examples.

## Supported platforms

| Platform   | Connect | Publish | Analytics | Comments | Messages | Ads |
| ---------- | :-----: | :-----: | :-------: | :------: | :------: | :-: |
| Instagram  |   ✅    |   🧪    |    🧪     |    🧪    |    ✅    |     |
| Facebook   |   ✅    |   🧪    |    🧪     |    🧪    |    ✅    |     |
| TikTok     |   ✅    |   ✅    |    ✅     |    ✅    |          |     |
| YouTube    |   ✅    |   ✅    |    ✅     |    ✅    |          |     |
| X          |   ✅    |   ✅    |           |          |          |     |
| Bluesky    |   ✅    |   ✅    |           |          |          |     |
| Meta Ads   |   🧪    |         |           |          |          | 🧪  |
| TikTok Ads |   🧪    |         |           |          |          | 🧪  |

✅ production&nbsp;&nbsp;🧪 beta, pending provider review. See [Feature availability](https://github.com/kingscrosslabs/adeli-sdk/blob/main/docs/availability.md).

## Runtimes

| Import               | Contents                                                | Runs on                                                         |
| -------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| `@adeli/sdk`         | The `Adeli` client, types, and error classes            | Node.js 22+, Vercel functions, Cloudflare Workers               |
| `@adeli/sdk/helpers` | Polling, comment iterators, and webhook verification    | Same. Webhook verification needs `node:crypto` (Workers: `nodejs_compat`) |
| `@adeli/sdk/uploads` | `fileFromPath` and `blobFromPath`                       | Node.js only                                                    |

The SDK throws in browsers.

## Documentation

- [Client and request semantics](https://github.com/kingscrosslabs/adeli-sdk/blob/main/docs/client.md): retries, timeouts, errors, and runtimes
- [Publishing and uploads](https://github.com/kingscrosslabs/adeli-sdk/blob/main/docs/publishing.md): payloads for each platform, and partial outcomes
- [API reference](https://www.tryadeli.com/docs/api): every operation
- [Feature availability](https://github.com/kingscrosslabs/adeli-sdk/blob/main/docs/availability.md): production compared with beta

## License

[MIT](https://github.com/kingscrosslabs/adeli-sdk/blob/main/LICENSE) © King's Cross Labs
