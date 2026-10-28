---
"@adeli/sdk": minor
---

Add `client.messages.sendInstagramMessage` for `POST /api/v1/messages/instagram`: Instagram DMs to a person (`recipient: { id }`) or private replies to a comment (`recipient: { commentId }`), with up to three optional `postback` or `url` buttons. `sendMessage` is unchanged.
