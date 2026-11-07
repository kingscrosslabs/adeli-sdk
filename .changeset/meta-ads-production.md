---
"@adeli/sdk": patch
---

Meta Ads (`meta_ads`) is now available on the production API: `startConnection` with `platform: 'meta_ads'`, Page selection, and every `client.ads` operation on a Meta Ads account no longer answer `422 provider_not_configured` there. No code changes; the README platform matrix and `docs/availability.md` mark Meta Ads as production.
