---
'@adeli/sdk': minor
---

`webhooks.createWebhook()` accepts an optional `platform` (`'instagram'` or `'tiktok'`) to receive one platform's events only, and every `Webhook` returned by `createWebhook()` and `listWebhooks()` now carries `platform` (typed optional for compatibility, always sent), `null` for a webhook that receives every supported platform. Omitting `platform` keeps the previous behavior. `message.postback` with `platform: 'tiktok'` is refused with `422 unsupported_for_platform`.
