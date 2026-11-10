---
'@adeli/sdk': minor
---

Add `messages.getInstagramUser({ path: { igsid }, query: { accountId } })`, which reads someone who has messaged an Instagram account, live, with `user.isFollowing` (whether they follow the account), `isFollowedByAccount`, `username`, `name` and `followerCount`. Instagram answers only after the person has messaged the account or tapped one of its buttons; before that it is `409 user_consent_required`, and an unknown id is `404 user_not_found`. `MessageCreatedEvent` gains `data.story` (`MessageCreatedStory`, `{ type: 'reply' | 'mention', id, url }` or null): set when an Instagram message replies to the account's story or mentions the account in someone else's. A server that does not send `story` parses as `story: null`.
