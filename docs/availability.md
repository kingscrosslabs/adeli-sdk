# Feature availability

The SDK types the whole public contract, but not every operation is live on every Adeli deployment. Production (`https://app.tryadeli.com`) offers only approved features. The beta deployment also offers features that are in provider review. Availability is not part of the OpenAPI contract, so the SDK cannot check it at compile time. Read the runtime signals below.

## Production

| Platform | Available in production | Beta only |
| --- | --- | --- |
| `instagram` | Connect, profile, `listPosts`, messages | Publishing, analytics, comments |
| `facebook` | Connect, profile, Page selection, `listPosts`, messages | Publishing, analytics, comments |
| `tiktok` | Connect, profile, `listPosts`, publishing, analytics, comments, refresh | — |
| `youtube` | Connect, profile, `listPosts`, publishing, analytics, comments, refresh | — |
| `x` | Connect, profile, publishing, refresh | — |
| `bluesky` | Connect, profile, publishing | — |
| `linkedin` | — | Connect (personal profile or Page), profile, publishing, analytics |
| `meta_ads` | — | Connect and every `client.ads` operation |
| `tiktok_ads` | — | Connect and every `client.ads` operation |

`whatsapp` appears in the account and connect platform enums, but `startConnection` does not support it yet and answers `422 provider_not_supported`.

## Runtime signals

- **Ads.** On a deployment without Meta Ads or TikTok Ads, `client.ads` calls for that network answer `404 not_found`, and `startConnection` with `platform: 'meta_ads'` answers `422 provider_not_configured`.
- **Instagram and Facebook.** Publishing, analytics, and comments in production depend on Meta-approved permissions. Read the account's `capabilities`, `missingPermissions`, and `missingResources` before calling; a call without them throws `PermissionRequiredError` (`permission_required`).
- **LinkedIn.** Adeli's LinkedIn app is on LinkedIn's Development Tier, so LinkedIn runs only on beta and production answers `422 provider_not_available`. Analytics come from a snapshot Adeli refreshes at most every six hours: read `fetchedAt`, and `stale: true` means LinkedIn rate-limited the refresh. A personal profile's post insights cover only posts published through Adeli; others answer `404 post_not_found`.
- **Other platforms.** A capability the account was not granted reports `false` in `capabilities` and fails with `permission_required`.

`baseURL: 'https://beta.tryadeli.com'` reaches the beta deployment. It is an opt-in App Review target, not a release channel, an API version, or the SDK's default origin; a feature there is not yet available in production.
