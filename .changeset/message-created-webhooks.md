---
'@adeli/sdk': minor
---

Type `message.created` webhook events (`MessageCreatedEvent`): an inbound Instagram, Facebook or WhatsApp direct message with `messageId`, `conversationKey`, `from`, `text` (null for attachments only), `attachments`, `replyTo` and `isEcho`. Webhooks register for the new `facebook` and `whatsapp` platforms (`WebhookPlatform`), and `testWebhook` sends `message.created` samples. Every message from `listMessages` and `sendMessage` carries an optional `conversationKey`, and `listMessages` accepts `conversationKey` (with `accountId`), `cursor` and `limit` to read one conversation newest page first, returning `nextCursor` toward older messages; `iterateConversation` and `iterateConversationPages` in `@adeli/sdk/helpers` follow that cursor. `sendMessage` accepts WhatsApp free `text` inside the 24-hour window as well as a template. Code that switched exhaustively over webhook event types or platforms should handle the new members.
