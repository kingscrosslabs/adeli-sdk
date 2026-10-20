import { Adeli } from '@adeli/node';
import { waitForTikTokPost } from '@adeli/node/helpers';
import { fileFromPath } from '@adeli/node/uploads';

export async function uploadTikTok(input: { accountId: string; videoPath: string }) {
  const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
  const creator = await client.posts.getTikTokCreatorInfo({ query: { accountId: input.accountId } });
  const upload = await client.posts.createPost({ body: {
    platform: 'tiktok', accountId: input.accountId,
    video: await fileFromPath(input.videoPath, { contentType: 'video/mp4' }),
    music_usage_confirmed: true,
  } });
  // The upload response's provider identifier is intentionally returned to the caller.
  const publishId = (upload.data as { publishId?: string }).publishId;
  if (publishId === undefined) return { creator, upload };
  const status = await waitForTikTokPost(client, {
    query: { accountId: input.accountId, publishId },
  }, { timeoutMs: 300_000, intervalMs: 2_000 });
  return { creator, upload, status };
}
