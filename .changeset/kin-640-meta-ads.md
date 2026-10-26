---
"@adeli/sdk": minor
---

Add the `meta_ads` platform for accounts and `startConnection`. Ads operations now take a Meta Ads account, connected separately from Facebook: pass its `accountId` (or a `profileId`), and Ads responses report `platform: 'meta_ads'`. A Facebook account id is no longer accepted by Ads operations and returns `account_not_found`. Campaign records add `metaAdsConnectionId`.
