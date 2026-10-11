import { describeMetaConfigFailure, describeWhatsAppIntegration, parseMetaWhatsAppConfig, type EnvSource } from './meta-config';
import { nextMessageStatus, parseWhatsAppWebhook, sanitizeProviderMessage, sessionWindowOpen, toWhatsAppRecipient, whatsAppClientStatus } from './meta-payload';
import { safeEqual, signWebhookBody, verifyWebhookSignature, webhookChallenge } from './meta-signature';
import { MetaWhatsAppProvider } from './meta-whatsapp.provider';

const TOKEN = 'EAAJBthisisatesttokenvalue1234567890';
const SECRET = '0123456789abcdef0123456789abcdef';

function env(values: Record<string, string | undefined>): EnvSource {
  return { get: (key) => values[key] };
}

function validEnv(overrides: Record<string, string | undefined> = {}) {
  return env({
    META_WABA_ID: '123456789012345',
    META_PHONE_NUMBER_ID: '109876543210987',
    META_ACCESS_TOKEN: TOKEN,
    META_APP_SECRET: SECRET,
    META_GRAPH_API_VERSION: 'v25.0',
    META_WEBHOOK_VERIFY_TOKEN: 'verify-token-value',
    PUBLIC_BASE_URL: 'https://crm.example.com',
    ...overrides,
  });
}

function providerConfig() {
  const parsed = parseMetaWhatsAppConfig(validEnv());
  if (!parsed.ok) throw new Error('expected valid config');
  return parsed.config;
}

describe('Meta WhatsApp configuration', () => {
  it('accepts the supported Graph API versions and rejects retired or unknown ones', () => {
    expect(parseMetaWhatsAppConfig(validEnv()).ok).toBe(true);
    for (const version of ['v21.0', 'v22.0', 'v23.0', 'v24.0', 'v25.0', 'v26.0']) {
      expect(parseMetaWhatsAppConfig(validEnv({ META_GRAPH_API_VERSION: version })).ok).toBe(true);
    }
    const retired = parseMetaWhatsAppConfig(validEnv({ META_GRAPH_API_VERSION: 'v20.0' }));
    expect(retired.ok).toBe(false);
    if (!retired.ok) expect(retired.invalid).toContain('META_GRAPH_API_VERSION');
    expect(parseMetaWhatsAppConfig(validEnv({ META_GRAPH_API_VERSION: 'v27.0' })).ok).toBe(false);
  });

  it('names missing credentials and does not echo secret values', () => {
    const parsed = parseMetaWhatsAppConfig(env({ META_ACCESS_TOKEN: TOKEN, META_GRAPH_API_VERSION: 'not-a-version' }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.missing).toEqual(expect.arrayContaining(['META_PHONE_NUMBER_ID', 'META_APP_SECRET', 'PUBLIC_BASE_URL']));
    expect(parsed.invalid).toContain('META_GRAPH_API_VERSION');
    expect(describeMetaConfigFailure(parsed)).not.toContain(TOKEN);
  });

  it('reports meta as untested until a probe succeeds, and mock as not connected', () => {
    const untested = describeWhatsAppIntegration({ provider: 'meta', demoMode: false, env: validEnv(), probe: null });
    expect(untested.configuration).toBe('valid');
    expect(untested.connection).toBe('untested');
    expect(untested.mode).toBe('meta');
    expect(untested.publicWebhookUrl).toBe('https://crm.example.com/api/webhooks/whatsapp');
    expect(JSON.stringify(untested)).not.toContain(TOKEN);
    expect(JSON.stringify(untested)).not.toContain(SECRET);

    const connected = describeWhatsAppIntegration({
      provider: 'meta',
      demoMode: true,
      env: validEnv(),
      probe: {
        connection: 'connected',
        detail: 'Meta accepted the access token for the configured phone number.',
        checkedAt: '2026-10-11T00:00:00.000Z',
        displayPhoneNumber: '+91 98765 43210',
        verifiedName: 'AIJewel',
      },
    });
    expect(connected.connection).toBe('connected');
    expect(connected.displayPhoneNumber).toBe('+91 98765 43210');

    const mock = describeWhatsAppIntegration({ provider: 'mock', demoMode: true, env: env({}), probe: null });
    expect(mock.mode).toBe('demo');
    expect(mock.connection).toBe('not_applicable');
    expect(mock.connectionDetail).toContain('not sent to Meta');
  });

  it('does not call a configured probe connected when the configuration is invalid', () => {
    const status = describeWhatsAppIntegration({
      provider: 'meta',
      demoMode: false,
      env: env({}),
      probe: {
        connection: 'connected',
        detail: 'should be ignored',
        checkedAt: '2026-10-11T00:00:00.000Z',
        displayPhoneNumber: '+1 555',
        verifiedName: 'Nope',
      },
    });
    expect(status.configuration).toBe('missing');
    expect(status.connection).toBe('untested');
    expect(status.displayPhoneNumber).toBeNull();
  });
});

describe('Meta webhook security', () => {
  it('returns the challenge only when the verify token matches', () => {
    const query = { hub: { mode: 'subscribe', verify_token: 'verify-token-value', challenge: '12345' } };
    expect(webhookChallenge(query, 'verify-token-value')).toBe('12345');
    expect(webhookChallenge(query, 'other-token-value')).toBeNull();
    expect(webhookChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '999' }, 'verify-token-value')).toBeNull();
    expect(webhookChallenge({ hub: { mode: 'unsubscribe', verify_token: 'verify-token-value', challenge: '12345' } }, 'verify-token-value')).toBeNull();
  });

  it('verifies the exact raw body and rejects a changed body or secret', () => {
    const body = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');
    const signature = signWebhookBody(body, SECRET);
    expect(verifyWebhookSignature(body, signature, SECRET)).toBe(true);
    expect(verifyWebhookSignature(Buffer.from(`${body.toString()} `), signature, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, signature, 'fedcba9876543210fedcba9876543210')).toBe(false);
    expect(verifyWebhookSignature(body, undefined, SECRET)).toBe(false);
    expect(safeEqual('short', 'a-much-longer-value')).toBe(false);
  });
});

describe('WhatsApp Cloud API payload rules', () => {
  it('normalizes recipient numbers and keeps the customer service window at 24 hours', () => {
    expect(toWhatsAppRecipient('+91 98765 43210')).toBe('919876543210');
    expect(toWhatsAppRecipient('9876543210')).toBe('919876543210');
    expect(toWhatsAppRecipient('123')).toBeNull();
    const now = new Date('2026-10-11T12:00:00.000Z');
    expect(sessionWindowOpen(null, now)).toBe(false);
    expect(sessionWindowOpen(new Date(now.getTime() - 23 * 60 * 60 * 1000), now)).toBe(true);
    expect(sessionWindowOpen(new Date(now.getTime() - 24 * 60 * 60 * 1000), now)).toBe(false);
  });

  it('moves delivery forward and never treats an API acceptance as delivered', () => {
    expect(nextMessageStatus('SENT', 'DELIVERED')).toBe('DELIVERED');
    expect(nextMessageStatus('DELIVERED', 'READ')).toBe('READ');
    expect(nextMessageStatus('SENT', 'FAILED')).toBe('FAILED');
    expect(nextMessageStatus('READ', 'DELIVERED')).toBeNull();
    expect(nextMessageStatus('FAILED', 'SENT')).toBeNull();
    expect(nextMessageStatus('SENT', 'SENT')).toBeNull();
    expect(nextMessageStatus('DELIVERED', 'SENT')).toBeNull();
  });

  it('parses inbound text and status webhooks', () => {
    const events = parseWhatsAppWebhook({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123456789012345',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '109876543210987' },
                contacts: [{ profile: { name: 'Asha' }, wa_id: '919876543210' }],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.IN',
                    timestamp: '1710000000',
                    type: 'text',
                    text: { body: 'Hello' },
                  },
                ],
                statuses: [
                  {
                    id: 'wamid.OUT',
                    status: 'delivered',
                    timestamp: '1710000001',
                    recipient_id: '919876543210',
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(events).toEqual([
      expect.objectContaining({ kind: 'message', body: 'Hello', profileName: 'Asha', providerMessageId: 'wamid.IN' }),
      expect.objectContaining({ kind: 'status', status: 'DELIVERED', providerMessageId: 'wamid.OUT' }),
    ]);
  });

  it('does not use HTTP 401 for a Meta auth failure, so the CRM session stays signed in', () => {
    expect(whatsAppClientStatus(401)).toBe(502);
    expect(whatsAppClientStatus(403)).toBe(502);
    expect(whatsAppClientStatus(429)).toBe(429);
  });

  it('strips bearer tokens from provider errors', () => {
    expect(sanitizeProviderMessage('bad bearer EAAJBthisisatesttokenvalue1234567890')).not.toContain(TOKEN);
  });
});

describe('MetaWhatsAppProvider', () => {
  it('posts a text message and records only API acceptance', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const http = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init: init ?? {} });
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.HBgM' }] }), { status: 200 });
    }) as typeof fetch;
    const provider = new MetaWhatsAppProvider(providerConfig(), http);
    const sent = await provider.sendMessage({ to: '+919876543210', body: 'Hello from AIJewel' });
    expect(sent).toEqual({ providerMessageId: 'wamid.HBgM', status: 'SENT' });
    expect(await provider.getMessageStatus('wamid.HBgM')).toBe('SENT');
    expect(calls[0].url).toBe('https://graph.facebook.com/v25.0/109876543210987/messages');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0].url).not.toContain(TOKEN);
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      messaging_product: 'whatsapp',
      to: '919876543210',
      type: 'text',
      text: { body: 'Hello from AIJewel' },
    });
  });

  it('maps auth failures, rate limits, and timeouts without leaking the token', async () => {
    const auth = new MetaWhatsAppProvider(providerConfig(), (async () =>
      new Response(JSON.stringify({ error: { message: `token ${TOKEN}`, code: 190, fbtrace_id: 'trace' } }), { status: 401 })) as typeof fetch);
    await expect(auth.sendMessage({ to: '919876543210', body: 'Hi' })).rejects.toMatchObject({ errorCode: 'WHATSAPP_AUTH_FAILED' });

    const limited = new MetaWhatsAppProvider(providerConfig(), (async () =>
      new Response(JSON.stringify({ error: { message: 'limit', code: 4 } }), { status: 429, headers: { 'retry-after': '30' } })) as typeof fetch);
    await expect(limited.sendMessage({ to: '919876543210', body: 'Hi' })).rejects.toMatchObject({
      errorCode: 'WHATSAPP_RATE_LIMITED',
      retryAfterSeconds: 30,
    });

    const timeout = new MetaWhatsAppProvider(providerConfig(), (async () => {
      const error = new Error('timed out');
      error.name = 'TimeoutError';
      throw error;
    }) as typeof fetch);
    await expect(timeout.sendMessage({ to: '919876543210', body: 'Hi' })).rejects.toMatchObject({ errorCode: 'WHATSAPP_TIMEOUT' });
  });

  it('marks the phone number connected only when Meta returns the configured id', async () => {
    const ok = new MetaWhatsAppProvider(providerConfig(), (async () =>
      new Response(JSON.stringify({ id: '109876543210987', display_phone_number: '+91 98765 43210', verified_name: 'AIJewel' }), { status: 200 })) as typeof fetch);
    await expect(ok.probeConnection()).resolves.toMatchObject({ connection: 'connected', verifiedName: 'AIJewel' });

    const mismatch = new MetaWhatsAppProvider(providerConfig(), (async () =>
      new Response(JSON.stringify({ id: '000000000000000' }), { status: 200 })) as typeof fetch);
    await expect(mismatch.probeConnection()).resolves.toMatchObject({ connection: 'failed', displayPhoneNumber: null });
  });
});
