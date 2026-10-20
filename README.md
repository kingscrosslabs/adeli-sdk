# @adeli/node

Server-only TypeScript SDK for Adeli, for **Node.js 22 and 24**. This repository currently contains the unpublished `0.1.0` candidate; it is not an npm availability claim. Until publication is authorized, consume a reviewed local tarball.

Build and pack the reviewed candidate, then install that exact local file in an application:

```sh
# SDK checkout
npm run build
npm pack

# application checkout (use the tarball path printed by npm pack)
npm install /absolute/path/to/adeli-node-0.1.0.tgz
```

The quickstart below only performs a read; it does not publish, connect an account, or mutate remote resources.

```ts
import { Adeli } from '@adeli/node';

export async function readProfiles() {
  const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
  const response = await client.profiles.listProfiles();
  return response.data.profiles;
}
```

The API key is resolved at construction from `apiKey` or `ADELI_API_KEY`; do not put it in browser, Bun, Deno, edge, or client-side application code. The quickstart above performs a safe read only. Writes, publishing, account connection, and deletion happen only when a caller explicitly invokes the corresponding method.

## Entry points

- `@adeli/node`: `Adeli`, resources, response types, and root error classes.
- `@adeli/node/helpers`: bounded polling and TikTok/YouTube comment iterators.
- `@adeli/node/uploads`: Node file-backed `Blob`/`File` adapters for multipart uploads.

Resources are navigated as `client.profiles`, `client.accounts`, `client.posts`, `client.comments`, `client.messages`, `client.analytics`, `client.ads`, and `client.usage`. Every result retains its `data`, HTTP `status`, and `Headers`; `204` has `data: undefined`, and `202`/`207` are successful responses. Provider casing, nulls, privacy values, partial records, and error details are not normalized away.

Default retries are zero. Timeouts are local total deadlines: cancelling a request does not prove that remote publishing or upload work was undone. See [`docs/client.md`](docs/client.md) and [`docs/publishing.md`](docs/publishing.md) for scopes, permissions, payloads, multipart files, and partial outcomes. The pinned OpenAPI snapshot is a local unreleased candidate and must be reviewed before relying on generated contracts.
