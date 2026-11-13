---
"@adeli/sdk": minor
---

Meta Ads: `ads.getAdTree`, `ads.getAdInsights`, `ads.getAdAccount` and `ads.listAdLeads` accept `refresh` (re-read from Meta, at most once a minute), and tree and insights responses may carry `stale: true` when an older stored copy was served while Meta was rate limiting. `ads.updateCampaign` and `ads.updateAdGroup` accept `confirmLargeChange` for a budget increase of more than 50%. Meta Ads changes may answer `429 ads_change_limited` with `Retry-After`, `409 confirmation_required` or `422 ads_writes_paused`.
