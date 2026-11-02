---
"@adeli/sdk": minor
---

Widen the LinkedIn `createPost` variant: `image` also takes a staged `{ upload_id, title? }`, and a post can instead carry `images` (2–20), a `video`, or a PDF `document`, each staged with `createMediaUploads`, which now accepts `platform: 'linkedin'`. Add optional organization `mentions`. Code that narrows LinkedIn `image` to the base64 shape, or switches exhaustively over the media-upload platform, needs a new branch.
