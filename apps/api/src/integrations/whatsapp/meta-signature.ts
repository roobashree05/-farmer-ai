import { createHash, createHmac, timingSafeEqual } from 'crypto';

export function safeEqual(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  const equal = timingSafeEqual(leftDigest, rightDigest);
  return left.length > 0 && right.length > 0 && equal;
}

export function signWebhookBody(rawBody: Buffer, appSecret: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
}

export function verifyWebhookSignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header || !appSecret || !rawBody) return false;
  const expected = signWebhookBody(rawBody, appSecret);
  return safeEqual(expected, header.trim());
}

export interface HubSubscription {
  mode: string;
  token: string;
  challenge: string;
}

export function readHubSubscription(query: Record<string, unknown>): HubSubscription {
  const nested = query.hub;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const hub = nested as Record<string, unknown>;
    return {
      mode: stringValue(hub.mode),
      token: stringValue(hub.verify_token),
      challenge: stringValue(hub.challenge),
    };
  }
  return {
    mode: stringValue(query['hub.mode']),
    token: stringValue(query['hub.verify_token']),
    challenge: stringValue(query['hub.challenge']),
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function webhookChallenge(query: Record<string, unknown>, expectedToken: string): string | null {
  const hub = readHubSubscription(query);
  if (hub.mode !== 'subscribe') return null;
  if (!hub.challenge || hub.challenge.length > 1024) return null;
  if (!safeEqual(hub.token, expectedToken)) return null;
  return hub.challenge;
}
