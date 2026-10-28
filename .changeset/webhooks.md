---
"@adeli/sdk": minor
---

Add `client.webhooks` (`listWebhooks`, `createWebhook`, `deleteWebhook`) for profile-scoped webhooks that deliver `comment.created` and `message.postback` events. `createWebhook` returns the signing secret once. Add `verifyWebhookSignature` and `parseWebhookEvent` to `@adeli/sdk/helpers`: verify the `Adeli-Signature` header against the raw body (constant-time, 300-second default tolerance), then parse it into a typed event, with unrecognised types parsed as `type: 'unknown'`.
