# @adeli/sdk

Server-only TypeScript SDK for Adeli, for **Node.js 24**.

```sh
npm install @adeli/sdk
```

The quickstart below only performs a read; it does not publish, connect an account, or mutate remote resources.

```ts
import { Adeli } from '@adeli/sdk';

export async function readProfiles() {
  const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
  const response = await client.profiles.listProfiles();
  return response.data.profiles;
}
```

The API key is resolved at construction from `apiKey` or `ADELI_API_KEY`; do not put it in browser, Bun, Deno, edge, or client-side application code. The quickstart above performs a safe read only. Writes, publishing, account connection, and deletion happen only when a caller explicitly invokes the corresponding method.

## Entry points

- `@adeli/sdk`: `Adeli`, resources, response types, and root error classes.
- `@adeli/sdk/helpers`: bounded polling (including asynchronous Instagram publication) and TikTok/YouTube comment iterators.
- `@adeli/sdk/uploads`: Node file-backed `Blob`/`File` adapters and direct staged-upload types. File-oriented post helpers initiate short-lived PUTs, stream bytes straight to S3, then submit small upload-reference JSON.

Resources are navigated as `client.profiles`, `client.accounts`, `client.posts`, `client.comments`, `client.messages`, `client.analytics`, `client.ads`, and `client.usage`. Every result retains its `data`, HTTP `status`, and `Headers`; `204` has `data: undefined`, and `202`/`207` are successful responses. Provider casing, nulls, privacy values, partial records, and error details are not normalized away.

Default retries are zero. Timeouts are local total deadlines: cancelling a request does not prove that remote publishing or upload work was undone. See [`docs/client.md`](docs/client.md) and [`docs/publishing.md`](docs/publishing.md) for scopes, permissions, payloads, direct media uploads, legacy multipart compatibility, and partial outcomes. [`docs/availability.md`](docs/availability.md) lists which platforms and features production offers. The pinned OpenAPI snapshot is a local unreleased candidate and must be reviewed before relying on generated contracts.
