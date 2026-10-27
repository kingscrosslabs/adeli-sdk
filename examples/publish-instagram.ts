import { Adeli, type CreatePostBody } from '@adeli/sdk';

export async function publishInstagramImage(input: { accountId: string; imageBase64: string }) {
  const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
  const body: CreatePostBody = {
    platform: 'instagram',
    accountId: input.accountId,
    caption: 'An explicitly requested example',
    image: { contentType: 'image/jpeg', base64: input.imageBase64 },
  };
  return client.posts.createPost({ body });
}

export async function publishInstagramReel(input: { accountId: string; videoUrl: string }) {
  const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
  const body: CreatePostBody = {
    platform: 'instagram',
    accountId: input.accountId,
    reel: { url: input.videoUrl },
    shareToFeed: true,
  };
  return client.posts.createPost({ body });
}
