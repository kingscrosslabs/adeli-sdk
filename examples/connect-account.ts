import { Adeli } from '@adeli/sdk';
import { waitForConnection } from '@adeli/sdk/helpers';

export async function connectAccount(input: {
  profileId: string;
  platform: 'instagram' | 'tiktok' | 'facebook' | 'youtube';
  redirectUrl: string;
}) {
  const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
  const started = await client.profiles.startConnection({
    path: { profileId: input.profileId },
    body: { platform: input.platform, redirectUrl: input.redirectUrl },
  });
  // The caller may present started.data.authUrl in its approved browser flow.
  // Do not log or persist that URL as an SDK default.
  const terminal = await waitForConnection(client, {
    path: { profileId: input.profileId, connectionSessionId: started.data.id },
  }, { timeoutMs: 300_000, intervalMs: 2_000 });
  return terminal;
}
