# Publishing and uploads

Publishing is server-side and provider-specific. Pass the real platform payload rather than assuming one universal post model. JSON Instagram image/carousel/Reel/story payloads retain `contentType`, base64 or supported URL media, captions, collaborators, user tags, and Reel feed options. Facebook text/image/video/Reel, TikTok JSON or multipart, YouTube multipart, X, Bluesky, and LinkedIn have different fields and outcomes; preserve their response fields unchanged.

```ts
import { Adeli } from '@adeli/sdk';
import { fileFromPath } from '@adeli/sdk/uploads';

export async function uploadYouTube(input: { accountId: string; path: string }) {
  const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
  const response = await client.posts.uploadYouTubeVideo({ body: {
    accountId: input.accountId,
    video: await fileFromPath(input.path, { contentType: 'video/mp4' }),
    title: 'Example', privacy_status: 'private', made_for_kids: false,
  } });
  return response; // 202 is accepted work, not proof of public visibility.
}
```

LinkedIn's JSON variant uses `platform: 'linkedin'`, the `accountId` of a connected personal profile or organization Page, `commentary`, and optionally one `{ content_type, base64, title? }` JPEG, PNG, or GIF image. It publishes publicly and synchronously, and Adeli does not automatically retry ambiguous writes. The returned `providerId` is the post URN that `client.analytics.getLinkedInPostInsights` accepts.

Use `Blob`/`File` values or the Node file-backed adapter. File-backed uploads avoid silently base64-encoding multi-GB media; supported URL media is sent to Adeli, not fetched by this SDK. Multipart field names, repeated `photos[]`, booleans, zero values, thumbnail, privacy, kids, scheduling, and retained filenames are serialized as documented by each operation. The current candidate API caps are: TikTok multipart accepts one video up to 1,000,000,000 bytes, or 1–35 photos with each photo at most 20 MiB; YouTube multipart accepts a video up to 4 GiB and an optional JPEG/PNG thumbnail up to 50 MiB, with the total multipart request capped at 4 GiB including fields and multipart overhead. JSON `POST /api/v1/posts` is capped at 96 MiB, and an inline base64 video must decode to at most 64 MiB. These are local candidate API caps, not a global provider limit or SDK-side preflight; provider restrictions and validation remain authoritative, and file plus thumbnail plus fields must fit the YouTube total request cap. See the public [TikTok publishing page](https://www.tryadeli.com/docs/api/posts/publish-tiktok), [YouTube file upload page](https://www.tryadeli.com/docs/api/posts/upload-youtube-video-file), and [YouTube upload guide](https://developers.google.com/youtube/v3/guides/implementation/videos) for the current candidate and provider behavior. The SDK does not expose dashboard-only Instagram/Facebook multipart routes.

A `201`/`200` result may be synchronous; `202` means accepted processing; it does not guarantee final provider visibility. File-backed Instagram requests use staged references and return a durable job: use `waitForInstagramPost` or `client.posts.getInstagramPostStatus`, and treat `outcome_unknown` as terminal without automatic resubmission. Use `@adeli/sdk/helpers` status helpers explicitly. TikTok `SEND_TO_USER_INBOX` is delivery to the creator inbox, not public publication. `PUBLISH_COMPLETE` is terminal even without public IDs. YouTube `published` means provider processing completed, not that a video is public: retain `privacyStatus`, `publishAt`, and permalink. Facebook video status `PROCESSING` is provider video processing and terminates as `READY` or `ERROR`; it is not the OAuth connection status `pending_page_selection`. A Facebook connection can separately require Page selection through the dashboard before publishing, and the SDK does not complete that handoff.

Thread and aggregate operations may return `207` with successful records and per-item/provider failures. Consume successful results and surface errors; never automatically retry a partial or ambiguous write. A local timeout or cancellation only ends the SDK request and leaves remote outcome unknown. Inspect the provider/API before any resubmission. X reads can cost money. Both `createAdAccount` and `createCampaign` require an idempotency key and neither auto-retries; profile creation's key is optional.

## Instagram DMs and private replies

`client.messages.sendInstagramMessage` sends an Instagram DM to a person (`recipient: { id }`, their Instagram-scoped id) or a private reply to a comment (`recipient: { commentId }`), with up to three optional `postback` or `url` buttons. `sendMessage` is unchanged and does not take buttons or comment recipients. The `201` result's `recipient` is the person's Instagram-scoped id, including for a private reply, so a later DM can use `recipient: { id }`. A comment's `authorId` from `listComments` is the same id.

```ts
const reply = await client.messages.sendInstagramMessage({ body: {
  accountId,
  recipient: { commentId },
  text: 'Thanks for commenting! Want the link?',
  buttons: [{ type: 'postback', title: 'Send it', payload: 'send_link' }],
} });
```

Instagram allows one private reply per comment, within 7 days of the comment, and only for accounts connected with Instagram Login. A second reply to the same comment fails with `409 private_reply_already_sent`. After a private reply, send a follow-up DM only once the person responds, for example by tapping a postback button; otherwise the send fails with `409 window_closed`. An account connected with Facebook Login returns `400 unsupported_for_platform` for a private reply. Like every write, the SDK never retries a send automatically.
