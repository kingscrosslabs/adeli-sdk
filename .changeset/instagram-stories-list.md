---
'@adeli/sdk': minor
---

Add `posts.listInstagramStories({ query: { accountId } })`, which lists an Instagram account's active stories, newest first, read live: `id`, `mediaType`, `mediaProductType`, `mediaUrl` (null for video with licensed audio), `thumbnailUrl`, `permalink`, `timestamp`, and `expiresAt` (24 hours after `timestamp`). Exports `InstagramStory`, `InstagramStoriesResponse` and `ListInstagramStoriesQuery`.
