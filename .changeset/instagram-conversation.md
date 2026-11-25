---
"@adeli/sdk": minor
---

New `messages.getInstagramConversation({ path: { igsid }, query: { accountId, profileId?, limit? } })` reads the newest messages (default 5, at most 20) of an Instagram account's conversation with one person, live, newest first, with each message's `direction`, `fromId`, `text` and `createdAt`. A postback button tap also appears there as an inbound message whose text is the button's title, so it finds a tap whose `message.postback` webhook never arrived. New types: `GetInstagramConversationPath`, `GetInstagramConversationQuery`, `InstagramConversationResponse` and `InstagramConversationMessage`.
