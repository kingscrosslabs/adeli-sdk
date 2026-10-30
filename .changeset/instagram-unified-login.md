---
"@adeli/sdk": minor
---

Instagram connects through Meta's Instagram API with Unified Login. `authMethod` on connection sessions and Instagram accounts gains `"unified_login"`, the value every new Instagram connection reports; `"instagram_login"` and `"facebook_login"` remain for accounts connected earlier, and are deprecated as `startConnection` inputs (they run Unified Login too).

**Breaking:** `refreshAccounts` can return `expiresAt: null` for an Instagram account connected with Unified Login, whose token does not expire. Handle `null` wherever you parse `expiresAt` as a date.
