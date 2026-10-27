import { Adeli } from '@adeli/sdk';

/** Read-only discovery; invoke this from a server request or job. */
export async function quickstart(): Promise<Readonly<{ profileId: string; accountCount: number }>> {
  const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
  const identity = await client.getMe();
  const profiles = await client.profiles.listProfiles();
  const accounts = await client.accounts.listAccounts();
  // Keep identity available to the caller without logging credentials or payloads.
  void identity;
  return { profileId: profiles.data.profiles[0]?.id ?? '', accountCount: accounts.data.accounts.length };
}
