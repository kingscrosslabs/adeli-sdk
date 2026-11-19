import { Adeli, InstagramCapabilities } from '@adeli/sdk';
import { waitForConnection } from '@adeli/sdk/helpers';

/**
 * Connect Instagram asking only for comments and DMs, the way a Comment to DM
 * product would. The consent screen leaves out publishing and Insights, and
 * `forceReauth: false` skips Instagram's password prompt when the browser is
 * already logged in.
 */
export async function connectInstagramForComments(input: { profileId: string; redirectUrl: string }) {
  const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
  const started = await client.profiles.startConnection({
    path: { profileId: input.profileId },
    body: {
      platform: 'instagram',
      redirectUrl: input.redirectUrl,
      capabilities: [...InstagramCapabilities.engagement],
      forceReauth: false,
    },
  });
  // What the consent screen will ask for, to show before sending the customer there.
  const asked = started.data.requestedPermissions?.map((permission) => permission.label) ?? [];
  // Present started.data.authUrl in the customer's browser, then wait.
  const terminal = await waitForConnection(client, {
    path: { profileId: input.profileId, connectionSessionId: started.data.id },
  }, { timeoutMs: 300_000, intervalMs: 2_000 });
  return { asked, terminal };
}
