---
"@adeli/sdk": minor
---

**Breaking:** `posts.listPosts` returns one page: 25 posts by default, up to 100 with `limit`, newest first, with `nextCursor` (null when there are no more). Pass it back as `cursor` for older posts, or use the new `iteratePosts` / `iteratePostPages` helpers from `@adeli/sdk/helpers`, which follow `nextCursor` within `maxPages` (default 100). Code that relied on one call returning every post must page. A cursor is bound to the filters and `limit` it was made with (`400 invalid_cursor` otherwise).

Add `analytics.getInstagramPostInsights({ query: { accountId, postIds? | since?, until?, limit? } })`: per-post Instagram insights (views, reach, likes, comments, shares, saves, interactions; reels add `avgWatchTimeMs`/`avgWatchTimeSec`, `totalWatchTimeMs`/`totalWatchTimeSec` and `skipRate`; stories add `replies` and `navigation`), served from Adeli's store with each post's `fetchedAt`, per-metric `warnings`, `notFound`, `nextUntil` and a `sync` status. Exports `InstagramPostInsights`, `InstagramPostInsightsQuery` and `InstagramPostInsightsResponse` from the analytics resource module.
