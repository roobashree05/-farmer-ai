import { AppException } from '../../common/app.exception';
import { createAiProvider } from './create-ai-provider';
import { describeAiIntegration, describeAnthropicConfigFailure, parseAnthropicConfig, type EnvSource } from './anthropic-config';
import { AnthropicAIProvider, groundModelAnswer, sanitizeProviderMessage } from './anthropic-ai.provider';

const KEY = 'sk-ant-api03-thisisatestkeyvalue1234567890';

function env(values: Record<string, string | undefined>): EnvSource {
  return { get: (key) => values[key] };
}

function validEnv(overrides: Record<string, string | undefined> = {}) {
  return env({ ANTHROPIC_API_KEY: KEY, ...overrides });
}

function providerConfig() {
  const parsed = parseAnthropicConfig(validEnv());
  if (!parsed.ok) throw new Error('expected valid config');
  return parsed.config;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Anthropic configuration', () => {
  it('defaults the model and rejects a missing or malformed key', () => {
    const parsed = parseAnthropicConfig(validEnv());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.config.model).toBe('claude-sonnet-5');

    const missing = parseAnthropicConfig(env({}));
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.missing).toEqual(['ANTHROPIC_API_KEY']);
      expect(describeAnthropicConfigFailure(missing)).not.toContain('sk-ant');
    }

    const invalid = parseAnthropicConfig(validEnv({ ANTHROPIC_API_KEY: 'not-a-key', ANTHROPIC_MODEL: 'gpt-4' }));
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.invalid).toEqual(expect.arrayContaining(['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL']));
  });

  it('reports anthropic as untested until a probe succeeds, and mock as demo', () => {
    const untested = describeAiIntegration({ provider: 'anthropic', env: validEnv(), probe: null });
    expect(untested.configuration).toBe('valid');
    expect(untested.connection).toBe('untested');
    expect(untested.mode).toBe('anthropic');
    expect(untested.model).toBe('claude-sonnet-5');
    expect(JSON.stringify(untested)).not.toContain(KEY);

    const mock = describeAiIntegration({ provider: 'mock', env: env({}), probe: null });
    expect(mock.mode).toBe('demo');
    expect(mock.connection).toBe('not_applicable');
    expect(mock.connectionDetail).toContain('not sent to Anthropic');
  });

  it('refuses to construct an anthropic provider without a key and does not echo the key', () => {
    expect(createAiProvider(env({ AI_PROVIDER: 'mock' })).mode).toBe('mock');
    expect(() => createAiProvider(env({ AI_PROVIDER: 'claude' }))).toThrow(AppException);
    try {
      createAiProvider(env({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: KEY.slice(0, 8) }));
      throw new Error('expected startup to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).message).not.toContain(KEY.slice(0, 8));
    }
  });
});

describe('Anthropic provider', () => {
  const warranty = {
    title: 'Warranty',
    category: 'WARRANTY',
    content: 'AIJewel products include a 2 year warranty against manufacturing defects.',
  };

  it('sends the key only in the header and keeps a grounded answer', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const http = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        content: [{
          type: 'text',
          text: JSON.stringify({
            text: 'AIJewel products include a 2 year warranty against manufacturing defects.',
            confidence: 0.91,
            escalateToHuman: false,
            sources: [{ title: 'Warranty', category: 'WARRANTY' }],
          }),
        }],
      });
    });
    const provider = new AnthropicAIProvider(providerConfig(), http as typeof fetch);
    const answer = await provider.generateResponse({ message: 'What warranty do you provide?', documents: [warranty] });
    expect(answer.escalateToHuman).toBe(false);
    expect(answer.sources).toEqual([{ title: 'Warranty', category: 'WARRANTY' }]);
    expect(answer.text).toContain('2 year warranty');
    expect(calls[0]?.url).toBe('https://api.anthropic.com/v1/messages');
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('x-api-key')).toBe(KEY);
    expect(headers.get('anthropic-version')).toBe('2023-06-01');
    expect(String(calls[0]?.init?.body)).not.toContain(KEY);
  });

  it('quotes the knowledge document when the model adds a price', () => {
    const answer = groundModelAnswer(
      {
        text: 'The warranty costs 99999 rupees and lasts a lifetime.',
        confidence: 0.8,
        escalateToHuman: false,
        sources: [{ title: 'Warranty', category: 'WARRANTY' }],
      },
      'What warranty do you provide?',
      [warranty],
    );
    expect(answer.text).toBe(`Based on the AIJewel knowledge base (Warranty): ${warranty.content}`);
    expect(answer.text).not.toContain('99999');
    expect(answer.text).not.toContain('lifetime');
  });

  it('escalates a price question when the cited document has no number', () => {
    const answer = groundModelAnswer(
      {
        text: 'Showroom visits are welcome.',
        confidence: 0.4,
        escalateToHuman: false,
        sources: [{ title: 'Visits', category: 'FAQ' }],
      },
      'What is the price?',
      [{ title: 'Visits', category: 'FAQ', content: 'Showroom visits are welcome.' }],
    );
    expect(answer.escalateToHuman).toBe(true);
    expect(answer.sources).toEqual([]);
    expect(answer.text).toContain('knowledge base');
  });

  it('probes the model endpoint and records an auth failure without the key', async () => {
    const http = jest.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/v1/models/')) return jsonResponse({ id: 'claude-sonnet-5', type: 'model' });
      return jsonResponse({ error: { message: `bad ${KEY}` } }, 401);
    });
    const provider = new AnthropicAIProvider(providerConfig(), http as typeof fetch);
    const connected = await provider.probeConnection();
    expect(connected.connection).toBe('connected');
    expect(connected.model).toBe('claude-sonnet-5');
    expect(JSON.stringify(connected)).not.toContain(KEY);

    const denied = new AnthropicAIProvider(providerConfig(), jest.fn(async () => jsonResponse({ error: { message: `bad ${KEY}` } }, 401)) as typeof fetch);
    const failed = await denied.probeConnection();
    expect(failed.connection).toBe('failed');
    expect(failed.detail).toBe('Anthropic rejected the API key');
    expect(failed.detail).not.toContain(KEY);
    expect(sanitizeProviderMessage(`bad ${KEY}`)).toBe('bad [redacted]');
  });

  it('falls back to the local classifier when Claude returns an unknown status', async () => {
    const http = jest.fn(async () => jsonResponse({
      content: [{ type: 'text', text: '{"suggestedStatus":"HOT","reason":"buy now"}' }],
    }));
    const provider = new AnthropicAIProvider(providerConfig(), http as typeof fetch);
    const result = await provider.classifyLead('Please book a demo');
    expect(result.suggestedStatus).toBe('QUALIFIED');
  });
});
