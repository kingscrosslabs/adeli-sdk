---
'@adeli/sdk': minor
---

Add `client.publications` to publish one post to several accounts: `createPublication()` (with an optional `idempotencyKey`, which also makes the create eligible for opt-in retries), `getPublication()`, and `retryPublication()`, which re-runs only failed targets. `waitForPublication()` in `@adeli/sdk/helpers` polls until the publication is `published`, `partial`, or `failed` and reports each snapshot through `onProgress`. A shared `Blob`/`File` in a publication is uploaded once for every platform that uses it. `posts.createMediaUploads()` accepts `platforms` (several platforms for one upload) instead of `platform`, and TikTok `createPost` bodies accept `remove_editor_attribution`.
