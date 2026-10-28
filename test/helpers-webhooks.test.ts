import { describe, expect, it } from 'vitest';
import { ConfigurationError, MalformedResponseError } from '@adeli/sdk';
import { parseWebhookEvent, verifyWebhookSignature } from '@adeli/sdk/helpers';

// Fixed vectors shared with adeli's lib/webhooks/signature.ts. Do not regenerate them here.
const secret = 'whsec_test_secret';
const t = 1793136000;
const eventBody = '{"id":"evt_1","type":"comment.created"}';
const eventSignature = '8abba3b3d617616caaa8aceac7f544546e407f2dd13caa94750e855d18571030';
const emptySignature = 'fb6126475a8948b0be6f64fb2ab49f6e733dd2392cd6caa1524cb64a8c4c7262';
const header = (v1: string, timestamp: number | string = t) => `t=${timestamp},v1=${v1}`;

describe('verifyWebhookSignature', () => {
  it('accepts the fixed vectors as a string or raw bytes', () => {
    expect(verifyWebhookSignature({ payload: eventBody, header: header(eventSignature), secret, now: t })).toBe(true);
    expect(verifyWebhookSignature({ payload: new TextEncoder().encode(eventBody), header: header(eventSignature), secret, now: t })).toBe(true);
    expect(verifyWebhookSignature({ payload: '', header: header(emptySignature), secret, now: t })).toBe(true);
    expect(verifyWebhookSignature({ payload: '', header: ` t=${t} , v1=${emptySignature} `, secret, now: t })).toBe(true);
  });

  it('rejects a bad signature, another secret, or a changed body', () => {
    expect(verifyWebhookSignature({ payload: eventBody, header: header(emptySignature), secret, now: t })).toBe(false);
    expect(verifyWebhookSignature({ payload: eventBody, header: header(eventSignature), secret: 'whsec_other', now: t })).toBe(false);
    expect(verifyWebhookSignature({ payload: `${eventBody} `, header: header(eventSignature), secret, now: t })).toBe(false);
    expect(verifyWebhookSignature({ payload: eventBody, header: header(eventSignature, t + 1), secret, now: t })).toBe(false);
  });

  it('rejects a stale or future timestamp outside the tolerance', () => {
    expect(verifyWebhookSignature({ payload: eventBody, header: header(eventSignature), secret, now: t + 300 })).toBe(true);
    expect(verifyWebhookSignature({ payload: eventBody, header: header(eventSignature), secret, now: t + 301 })).toBe(false);
    expect(verifyWebhookSignature({ payload: eventBody, header: header(eventSignature), secret, now: t - 301 })).toBe(false);
    expect(verifyWebhookSignature({ payload: eventBody, header: header(eventSignature), secret, now: t + 3600, toleranceSeconds: 3600 })).toBe(true);
    expect(verifyWebhookSignature({ payload: eventBody, header: header(eventSignature), secret, now: t + 1, toleranceSeconds: 0 })).toBe(false);
    // The real clock is years past the vector timestamp.
    expect(verifyWebhookSignature({ payload: eventBody, header: header(eventSignature), secret })).toBe(false);
  });

  it.each([
    null, undefined, '', 'garbage', `v1=${eventSignature}`, `t=${t}`, `t=,v1=${eventSignature}`, `t=abc,v1=${eventSignature}`,
    `t=-1,v1=${eventSignature}`, `t=${t}.5,v1=${eventSignature}`, header(eventSignature.slice(1)), header(eventSignature.toUpperCase()),
    header(`${eventSignature}00`), `t=${t},v1=${eventSignature},t=${t}`, `t=${t},,v1=${eventSignature}`, `t=${t};v1=${eventSignature}`,
  ])('rejects the malformed header %j', (value) => {
    expect(verifyWebhookSignature({ payload: eventBody, header: value, secret, now: t })).toBe(false);
  });

  it('ignores unknown header fields so new schemes stay additive', () => {
    expect(verifyWebhookSignature({ payload: eventBody, header: `${header(eventSignature)},v2=future`, secret, now: t })).toBe(true);
  });

  it('throws for a missing secret or an invalid tolerance', () => {
    expect(() => verifyWebhookSignature({ payload: eventBody, header: header(eventSignature), secret: '', now: t })).toThrow(ConfigurationError);
    for (const toleranceSeconds of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => verifyWebhookSignature({ payload: eventBody, header: header(eventSignature), secret, now: t, toleranceSeconds })).toThrow(ConfigurationError);
    }
  });
});

const envelope = { id: 'evt_0123456789abcdef0123456789abcdef', createdAt: '2026-10-27T12:00:00.000Z', profileId: 'profile-1', platform: 'instagram', accountId: 'account-1' };
const commentData = { commentId: 'comment-1', mediaId: 'media-1', parentId: null, text: 'guide please', from: { id: 'igsid-1', username: 'person' }, isSelf: false };
const postbackData = { senderId: 'igsid-1', payload: 'send_link', title: 'Send it', messageId: null };

describe('parseWebhookEvent', () => {
  it('types comment.created and message.postback events', () => {
    const comment = parseWebhookEvent(JSON.stringify({ ...envelope, type: 'comment.created', data: commentData }));
    expect(comment).toEqual({ ...envelope, type: 'comment.created', data: commentData });
    if (comment.type !== 'comment.created') throw new Error('expected comment.created');
    expect(comment.data.from.id).toBe('igsid-1');
    const postback = parseWebhookEvent(new TextEncoder().encode(JSON.stringify({ ...envelope, type: 'message.postback', data: postbackData })));
    expect(postback).toEqual({ ...envelope, type: 'message.postback', data: postbackData });
  });

  it('parses an unrecognised type or platform as unknown instead of throwing', () => {
    expect(parseWebhookEvent(JSON.stringify({ ...envelope, type: 'message.received', data: { anything: true } }))).toEqual({ ...envelope, type: 'unknown', eventType: 'message.received', data: { anything: true } });
    expect(parseWebhookEvent(JSON.stringify({ ...envelope, platform: 'facebook', type: 'comment.created', data: {} }))).toMatchObject({ type: 'unknown', eventType: 'comment.created', platform: 'facebook' });
  });

  it.each([
    ['invalid JSON', '{'],
    ['a non-object body', '[]'],
    ['a missing envelope field', JSON.stringify({ ...envelope, id: undefined, type: 'comment.created', data: commentData })],
    ['a known event with mismatched data', JSON.stringify({ ...envelope, type: 'comment.created', data: { ...commentData, isSelf: 'no' } })],
    ['a postback without a payload', JSON.stringify({ ...envelope, type: 'message.postback', data: { ...postbackData, payload: undefined } })],
  ])('throws MalformedResponseError for %s', (_label, body) => {
    expect(() => parseWebhookEvent(body)).toThrow(MalformedResponseError);
  });

  it('rejects bytes that are not UTF-8', () => {
    expect(() => parseWebhookEvent(new Uint8Array([0xff, 0xfe]))).toThrow(MalformedResponseError);
  });
});
