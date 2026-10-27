import { Adeli } from '@adeli/sdk';
import { waitForYouTubeVideo } from '@adeli/sdk/helpers';
import { fileFromPath } from '@adeli/sdk/uploads';

export async function uploadYouTube(input: {
  accountId: string;
  videoPath: string;
  thumbnailPath?: string;
}) {
  const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
  const upload = await client.posts.uploadYouTubeVideo({ body: {
    accountId: input.accountId,
    video: await fileFromPath(input.videoPath, { contentType: 'video/mp4' }),
    thumbnail: input.thumbnailPath === undefined ? undefined : await fileFromPath(input.thumbnailPath, { contentType: 'image/jpeg' }),
    title: 'Explicitly requested example upload',
    description: 'Review privacy and scheduled publication before invoking.',
    privacy_status: 'private',
    made_for_kids: false,
  } });
  const videoId = (upload.data as { videoId?: string }).videoId;
  if (videoId === undefined) return upload;
  return waitForYouTubeVideo(client, {
    query: { accountId: input.accountId, videoId },
  }, { timeoutMs: 300_000, intervalMs: 2_000 });
}
