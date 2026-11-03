import { createServer } from 'node:http';
import { parseWebhookEvent, verifyWebhookSignature } from '@adeli/sdk/helpers';

/**
 * A local webhook receiver. Start it, register `http://localhost:4242` on a
 * local Adeli with `webhooks.createWebhook`, then call `webhooks.testWebhook`.
 */
export function startWebhookReceiver(port = Number(process.env.PORT ?? 4242)) {
  const secret = process.env.ADELI_WEBHOOK_SECRET;
  if (!secret) throw new Error('Set ADELI_WEBHOOK_SECRET to the secret createWebhook returned');
  return createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const payload = Buffer.concat(chunks);
    if (!verifyWebhookSignature({ payload, header: request.headers['adeli-signature'] as string | undefined, secret })) {
      response.writeHead(401).end();
      return;
    }
    const event = parseWebhookEvent(payload);
    if (event.type === 'comment.created' && event.platform === 'tiktok') {
      console.log(`TikTok comment on ${event.data.mediaId} from @${event.data.from.username ?? 'unknown'}: ${event.data.text}${event.test ? ' (test)' : ''}`);
    } else if (event.type === 'comment.created') {
      console.log(`Instagram comment on ${event.data.mediaId} from @${event.data.from.username ?? 'unknown'}: ${event.data.text}`);
    } else {
      console.log(`${event.type === 'unknown' ? event.eventType : event.type} on ${event.platform}`);
    }
    // Answer quickly; do slow work after responding.
    response.writeHead(204).end();
  }).listen(port);
}
