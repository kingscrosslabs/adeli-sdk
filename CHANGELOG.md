# @adeli/sdk

## 0.6.0

### Minor Changes

- 1e1b7bd: Meta Ads: `ads.createCampaign` accepts full Meta campaigns (objective, budget, schedule, bid strategy, targeting, image, video or carousel creatives, Instagram identity, existing campaign or ad set, `validateOnly`); `ads.updateAdGroup`, `ads.listAdTargeting` and `ads.getAdInsights` serve Meta; new `ads.updateCampaign`, `ads.deleteAdGroup`, `ads.deleteAd`, `ads.estimateAdReach` and `ads.listAdInstagramAccounts`.

### Patch Changes

- cf2f062: TikTok Ads is now available on the production API: `startConnection` with `platform: 'tiktok_ads'` and the `client.ads` operations TikTok supports. No code changes; the README platform matrix and `docs/availability.md` mark it as production.

## 0.5.0

### Minor Changes

- ed1c3f6: List the replies to an Instagram story. `Message` gains optional `story` (`{ type: 'reply' | 'mention', id, url }` or `null`, the same shape as `message.created`'s `data.story`), exported as `MessageStory`. `listMessages` accepts `storyId`, a reply's `story.id`, and then returns only the inbound Instagram replies to that story; each reply's `sender` is the IGSID to message back with `sendInstagramMessage`. `storyId` can't be combined with `conversationKey` or a non-Instagram `platform` (400 `invalid_request`), and `iterateConversation` does not accept it.
- 5b18c26: Add `posts.listInstagramStories({ query: { accountId } })`, which lists an Instagram account's active stories, newest first, read live: `id`, `mediaType`, `mediaProductType`, `mediaUrl` (null for video with licensed audio), `thumbnailUrl`, `permalink`, `timestamp`, and `expiresAt` (24 hours after `timestamp`). Exports `InstagramStory`, `InstagramStoriesResponse` and `ListInstagramStoriesQuery`.

## 0.4.0

### Minor Changes

- 14c151f: Add `messages.getInstagramUser({ path: { igsid }, query: { accountId } })`, which reads someone who has messaged an Instagram account, live, with `user.isFollowing` (whether they follow the account), `isFollowedByAccount`, `username`, `name` and `followerCount`. Instagram answers only after the person has messaged the account or tapped one of its buttons; before that it is `409 user_consent_required`, and an unknown id is `404 user_not_found`. `MessageCreatedEvent` gains `data.story` (`MessageCreatedStory`, `{ type: 'reply' | 'mention', id, url }` or null): set when an Instagram message replies to the account's story or mentions the account in someone else's. A server that does not send `story` parses as `story: null`.
- 603b639: Schedule publications and save drafts. `createPublication` accepts `scheduledFor` (ISO 8601 with an offset, one minute to 365 days ahead), `timeZone`, and `draft`; a scheduled publication or draft answers `201` with status `scheduled` or `draft`, and `Publication` gains `scheduledFor`, `timeZone`, and `canceledAt`. New `publications.listPublications`, `updatePublication` (reschedule or replace the post), `publishPublication` (publish now), and `cancelPublication`; the three writes are never retried automatically. `Publication['status']` adds `scheduled`, `draft`, and `canceled`, so an exhaustive `switch` needs three new branches. `listPosts` returns scheduled posts first, with optional `status: 'scheduled'`, `scheduledFor`, and `publicationId` on `NormalizedPost`. `waitForPublication` keeps waiting through `scheduled` and `draft` and treats `canceled` as terminal.

### Patch Changes

- ee0cd74: Instagram publishing, analytics and comments are now available on the production API, alongside connect, profile, `listPosts` and messages. No code changes; the README platform matrix and `docs/availability.md` mark them as production.

## 0.3.1

### Patch Changes

- a61b072: Meta Ads (`meta_ads`) is now available on the production API: `startConnection` with `platform: 'meta_ads'`, Page selection, and every `client.ads` operation on a Meta Ads account no longer answer `422 provider_not_configured` there. No code changes; the README platform matrix and `docs/availability.md` mark Meta Ads as production.

## 0.3.0

### Minor Changes

- b57c093: `apiKey` now accepts a resolver, `string | (() => string | Promise<string>)`, exported as the `ApiKey` and `ApiKeyResolver` types. The SDK calls a resolver before every request attempt, retries included, and never caches its result, so a rotated key is used on the next attempt. Each resolved value is validated before it is sent: an empty, blank, non-string or invalid header value throws `ConfigurationError`, and a resolver that throws or rejects surfaces as `ConfigurationError` with the original error as `cause`. Neither is retried. Static string keys behave as before.
- f2772c5: Adds `usage.getUsage()`, which returns how many posts, messages and comments the workspace has sent this UTC month, across all its profiles, against the free plan's limits (1,000 posts, 10,000 messages and 10,000 comments per workspace), with `limit: null` once the workspace has billing. On the free plan, a send past a limit now fails with `402 usage_limit_reached`, whose `details` carry `kind`, `limit`, `used`, `resetsAt` and `billingUrl`. `createPost`, `uploadYouTubeVideo`, `createPublication`, `retryPublication`, `sendMessage`, `sendInstagramMessage` and `createComment` can return it. It is not retried: it clears at `resetsAt` or once a card is added.
- 5daca5b: Add LinkedIn Ads: the `linkedin_ads` account and connect platform, the LinkedIn body for `createCampaign` (sponsor a Page post as draft campaigns), `linkedin_ads` on `setAdStatus` with `level`, professional-demographic `breakdown` values on `getAdInsights` (`job_function`, `seniority`, `industry`, `company_size`) with a `label` per row, LinkedIn on `updateAdGroup` and `listAdTargeting` (`locations`, `job_functions`, `seniorities`, `industries`, `company_sizes`, with `q`), and the member's `role`, `readOnly` and `organizationUrn` on LinkedIn ad accounts. A profile holding any two ad networks now needs `accountId` or `platform` on Ads calls.
- b737250: Add `client.analytics.getLinkedInAccountInsights` and `client.analytics.getLinkedInPostInsights` for LinkedIn Pages and personal profiles.
- 9df4ce1: Widen the LinkedIn `createPost` variant: `image` also takes a staged `{ upload_id, title? }`, and a post can instead carry `images` (2–20), a `video`, or a PDF `document`, each staged with `createMediaUploads`, which now accepts `platform: 'linkedin'`. Add optional organization `mentions`. Code that narrows LinkedIn `image` to the base64 shape, or switches exhaustively over the media-upload platform, needs a new branch.
- b737250: Add typed LinkedIn connection, account, and text/single-image post variants for a member's personal profile or an organization Page, through the private-preview Community Management integration.
- b57c093: Type `message.created` webhook events (`MessageCreatedEvent`): an inbound Instagram, Facebook or WhatsApp direct message with `messageId`, `conversationKey`, `from`, `text` (null for attachments only), `attachments`, `replyTo` and `isEcho`. Webhooks register for the new `facebook` and `whatsapp` platforms (`WebhookPlatform`), and `testWebhook` sends `message.created` samples. Every message from `listMessages` and `sendMessage` carries an optional `conversationKey`, and `listMessages` accepts `conversationKey` (with `accountId`), `cursor` and `limit` to read one conversation newest page first, returning `nextCursor` toward older messages; `iterateConversation` and `iterateConversationPages` in `@adeli/sdk/helpers` follow that cursor. `sendMessage` accepts WhatsApp free `text` inside the 24-hour window as well as a template. Code that switched exhaustively over webhook event types or platforms should handle the new members.
- 168f236: Type TikTok `comment.created` webhook events (`TikTokCommentCreatedEvent`, with `from.displayName`) instead of parsing them as `unknown`, and add `webhooks.testWebhook()` to send a signed sample event to a receiver. Every parsed event now carries `test`, true only for samples. `CommentCreatedEvent` is now a union of the Instagram and TikTok events: code that read `event.platform` as always `'instagram'` after checking `event.type === 'comment.created'` should check the platform too.
- 1dc0593: Add `client.publications` to publish one post to several accounts: `createPublication()` (with an optional `idempotencyKey`, which also makes the create eligible for opt-in retries), `getPublication()`, and `retryPublication()`, which re-runs only failed targets. `waitForPublication()` in `@adeli/sdk/helpers` polls until the publication is `published`, `partial`, or `failed` and reports each snapshot through `onProgress`. A shared `Blob`/`File` in a publication is uploaded once for every platform that uses it. `posts.createMediaUploads()` accepts `platforms` (several platforms for one upload) instead of `platform`, and TikTok `createPost` bodies accept `remove_editor_attribution`.
- 71eec5d: `webhooks.createWebhook()` accepts an optional `platform` (`'instagram'` or `'tiktok'`) to receive one platform's events only, and every `Webhook` returned by `createWebhook()` and `listWebhooks()` now carries `platform` (typed optional for compatibility, always sent), `null` for a webhook that receives every supported platform. Omitting `platform` keeps the previous behavior. `message.postback` with `platform: 'tiktok'` is refused with `422 unsupported_for_platform`.

## 0.2.1

### Patch Changes

- 666b95f: small readme.md update for SEO backlinking improvements

## 0.2.0

### Minor Changes

- 97c12ba: Instagram connects through Meta's Instagram API with Unified Login. `authMethod` on connection sessions and Instagram accounts gains `"unified_login"`, the value every new Instagram connection reports; `"instagram_login"` and `"facebook_login"` remain for accounts connected earlier, and are deprecated as `startConnection` inputs (they run Unified Login too).
  
  **Breaking:** `refreshAccounts` can return `expiresAt: null` for an Instagram account connected with Unified Login, whose token does not expire. Handle `null` wherever you parse `expiresAt` as a date.
- 910816b: Support Node.js 22 and later, and Cloudflare Workers with `nodejs_compat`.

## 0.1.1

### Patch Changes

- 94f660e: empty release to test publishing to npmjs

## 0.1.0

### Minor Changes

- Initial release of the server-side TypeScript SDK for Adeli on Node.js 24, with ESM and CommonJS entry points (`@adeli/sdk`, `@adeli/sdk/helpers`, `@adeli/sdk/uploads`), zero runtime dependencies, and types generated from the pinned OpenAPI contract.
- Add universal direct-to-S3 media uploads, staged post references, the `createMediaUploads` operation, and durable Instagram publication status/polling helpers while retaining file-oriented post helpers.
- Add the `meta_ads` platform for accounts and `startConnection`. Ads operations take a Meta Ads account, connected separately from Facebook: pass its `accountId` (or a `profileId`), and Ads responses report `platform: 'meta_ads'`. A Facebook account id is not accepted by Ads operations and returns `account_not_found`. Campaign records add `metaAdsConnectionId`.
- Add TikTok Ads: the `tiktok_ads` account platform, TikTok bodies for `createCampaign` and `setAdStatus` (with `level`), audience `breakdown` on `getAdInsights`, and the TikTok-only `updateAdGroup`, `listAdTargeting`, `listAdIdentities`, and `createAdIdentity` operations.
- Add the nullable `authorId` to comments returned by `listComments` and `createComment`. Instagram `createComment` now returns the full created comment.
- Add `client.messages.sendInstagramMessage` for `POST /api/v1/messages/instagram`: Instagram DMs to a person (`recipient: { id }`) or private replies to a comment (`recipient: { commentId }`), with up to three optional `postback` or `url` buttons. `sendMessage` is unchanged.
- Add `client.webhooks` (`listWebhooks`, `createWebhook`, `deleteWebhook`) for profile-scoped webhooks that deliver `comment.created` and `message.postback` events. `createWebhook` returns the signing secret once. Add `verifyWebhookSignature` and `parseWebhookEvent` to `@adeli/sdk/helpers`: verify the `Adeli-Signature` header against the raw body (constant-time, 300-second default tolerance), then parse it into a typed event, with unrecognised types parsed as `type: 'unknown'`.
