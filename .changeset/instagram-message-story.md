---
'@adeli/sdk': minor
---

List the replies to an Instagram story. `Message` gains optional `story` (`{ type: 'reply' | 'mention', id, url }` or `null`, the same shape as `message.created`'s `data.story`), exported as `MessageStory`. `listMessages` accepts `storyId`, a reply's `story.id`, and then returns only the inbound Instagram replies to that story; each reply's `sender` is the IGSID to message back with `sendInstagramMessage`. `storyId` can't be combined with `conversationKey` or a non-Instagram `platform` (400 `invalid_request`), and `iterateConversation` does not accept it.
