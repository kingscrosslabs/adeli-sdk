---
'@adeli/sdk': minor
---

Type TikTok `comment.created` webhook events (`TikTokCommentCreatedEvent`, with `from.displayName`) instead of parsing them as `unknown`, and add `webhooks.testWebhook()` to send a signed sample event to a receiver. Every parsed event now carries `test`, true only for samples. `CommentCreatedEvent` is now a union of the Instagram and TikTok events: code that read `event.platform` as always `'instagram'` after checking `event.type === 'comment.created'` should check the platform too.
