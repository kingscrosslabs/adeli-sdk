---
'@adeli/sdk': minor
---

Adds `usage.getUsage()`, which returns how many posts, messages and comments the workspace has sent this UTC month, across all its profiles, against the free plan's limits (1,000 posts, 10,000 messages and 10,000 comments per workspace), with `limit: null` once the workspace has billing. On the free plan, a send past a limit now fails with `402 usage_limit_reached`, whose `details` carry `kind`, `limit`, `used`, `resetsAt` and `billingUrl`. `createPost`, `uploadYouTubeVideo`, `createPublication`, `retryPublication`, `sendMessage`, `sendInstagramMessage` and `createComment` can return it. It is not retried: it clears at `resetsAt` or once a card is added.
