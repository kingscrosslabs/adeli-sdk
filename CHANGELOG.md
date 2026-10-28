# @adeli/sdk

## 0.1.1

### Patch Changes

- 76a6234: empty release to test publishing to npmjs

## 0.1.0

### Minor Changes

- Initial release of the server-side TypeScript SDK for Adeli on Node.js 24, with ESM and CommonJS entry points (`@adeli/sdk`, `@adeli/sdk/helpers`, `@adeli/sdk/uploads`), zero runtime dependencies, and types generated from the pinned OpenAPI contract.
- Add universal direct-to-S3 media uploads, staged post references, the `createMediaUploads` operation, and durable Instagram publication status/polling helpers while retaining file-oriented post helpers.
- Add the `meta_ads` platform for accounts and `startConnection`. Ads operations take a Meta Ads account, connected separately from Facebook: pass its `accountId` (or a `profileId`), and Ads responses report `platform: 'meta_ads'`. A Facebook account id is not accepted by Ads operations and returns `account_not_found`. Campaign records add `metaAdsConnectionId`.
- Add TikTok Ads: the `tiktok_ads` account platform, TikTok bodies for `createCampaign` and `setAdStatus` (with `level`), audience `breakdown` on `getAdInsights`, and the TikTok-only `updateAdGroup`, `listAdTargeting`, `listAdIdentities`, and `createAdIdentity` operations.
- Add the nullable `authorId` to comments returned by `listComments` and `createComment`. Instagram `createComment` now returns the full created comment.
- Add `client.messages.sendInstagramMessage` for `POST /api/v1/messages/instagram`: Instagram DMs to a person (`recipient: { id }`) or private replies to a comment (`recipient: { commentId }`), with up to three optional `postback` or `url` buttons. `sendMessage` is unchanged.
- Add `client.webhooks` (`listWebhooks`, `createWebhook`, `deleteWebhook`) for profile-scoped webhooks that deliver `comment.created` and `message.postback` events. `createWebhook` returns the signing secret once. Add `verifyWebhookSignature` and `parseWebhookEvent` to `@adeli/sdk/helpers`: verify the `Adeli-Signature` header against the raw body (constant-time, 300-second default tolerance), then parse it into a typed event, with unrecognised types parsed as `type: 'unknown'`.
