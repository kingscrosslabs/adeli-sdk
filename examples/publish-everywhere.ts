import { Adeli, type Publication } from '@adeli/sdk';
import { waitForPublication } from '@adeli/sdk/helpers';
import { fileFromPath } from '@adeli/sdk/uploads';

/** Publish one local video to TikTok, YouTube, and an Instagram Reel, uploading the file once. */
export async function publishEverywhere(input: {
  videoPath: string;
  caption: string;
  tiktokAccountId: string;
  youtubeAccountId: string;
  instagramAccountId: string;
  /** A stable key for this launch, so a retried request cannot publish twice. */
  idempotencyKey: string;
}): Promise<Publication> {
  const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
  const created = await client.publications.createPublication({ body: {
    content: input.caption,
    media: [await fileFromPath(input.videoPath, { contentType: 'video/mp4' })],
    platforms: [
      { platform: 'tiktok', accountId: input.tiktokAccountId, options: { music_usage_confirmed: true, privacy_level: 'SELF_ONLY' } },
      { platform: 'youtube', accountId: input.youtubeAccountId, options: { privacy_status: 'private', made_for_kids: false } },
      { platform: 'instagram', accountId: input.instagramAccountId, kind: 'reel' },
    ],
  } }, { idempotencyKey: input.idempotencyKey });

  const done = await waitForPublication(client, { path: { publicationId: created.data.id } }, {
    intervalMs: 3_000,
    timeoutMs: 600_000,
    onProgress: (publication) => console.log(`${Math.round(publication.progress * 100)}%`),
  });
  for (const target of done.data.targets) {
    if (target.status === 'failed') console.error(`${target.platform}: ${target.error?.message ?? 'failed'}`);
  }
  return done.data;
}
