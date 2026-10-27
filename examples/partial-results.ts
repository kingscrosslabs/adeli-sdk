import { Adeli } from '@adeli/sdk';

/** Read a partial aggregate without hiding provider-specific failures. */
export async function listAccountsWithOutcomes() {
  const client = new Adeli({ apiKey: process.env.ADELI_API_KEY });
  const response = await client.accounts.listAccounts();
  return {
    accounts: response.data.accounts,
    errors: response.data.errors,
    partial: response.data.status === 'partial',
  };
}
