export const ANTHROPIC_API_VERSION = '2023-06-01';

/** Current Messages API default for grounded CRM replies. Override with ANTHROPIC_MODEL. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';

export const ANTHROPIC_CONFIG_KEYS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL'] as const;

export type AnthropicConfigKey = (typeof ANTHROPIC_CONFIG_KEYS)[number];

export interface EnvSource {
  get(key: string): string | undefined;
}

export interface AnthropicConfig {
  apiKey: string;
  model: string;
}

export type AnthropicConfigResult =
  | { ok: true; config: AnthropicConfig }
  | { ok: false; reason: 'missing' | 'invalid'; missing: AnthropicConfigKey[]; invalid: AnthropicConfigKey[] };

export interface AiProbeState {
  connection: 'untested' | 'connected' | 'failed' | 'not_applicable';
  detail: string;
  checkedAt: string | null;
  model: string | null;
}

export interface AiIntegrationStatus {
  provider: 'mock' | 'anthropic' | 'other';
  mode: 'demo' | 'anthropic';
  configuration: 'not_applicable' | 'valid' | 'missing' | 'invalid';
  missing: string[];
  invalid: string[];
  connection: 'not_applicable' | 'untested' | 'connected' | 'failed';
  connectionDetail: string | null;
  checkedAt: string | null;
  model: string | null;
  defaultModel: string;
}

const API_KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{20,}$/;
const MODEL_PATTERN = /^claude-[a-z0-9][a-z0-9._-]{1,64}$/;

function blank(value: string | undefined): boolean {
  return !value || !value.trim();
}

export function parseAnthropicConfig(env: EnvSource): AnthropicConfigResult {
  const missing: AnthropicConfigKey[] = [];
  const invalid: AnthropicConfigKey[] = [];
  const apiKeyRaw = env.get('ANTHROPIC_API_KEY');
  const modelRaw = env.get('ANTHROPIC_MODEL');
  const apiKey = apiKeyRaw?.trim() ?? '';
  const model = blank(modelRaw) ? DEFAULT_ANTHROPIC_MODEL : modelRaw!.trim();

  if (!apiKey) missing.push('ANTHROPIC_API_KEY');
  else if (!API_KEY_PATTERN.test(apiKey)) invalid.push('ANTHROPIC_API_KEY');

  if (!MODEL_PATTERN.test(model)) invalid.push('ANTHROPIC_MODEL');

  if (missing.length > 0 || invalid.length > 0) {
    return { ok: false, reason: missing.length > 0 ? 'missing' : 'invalid', missing, invalid };
  }

  return { ok: true, config: { apiKey, model } };
}

export function describeAnthropicConfigFailure(result: Extract<AnthropicConfigResult, { ok: false }>): string {
  const parts: string[] = [];
  if (result.missing.length > 0) parts.push(`Missing: ${result.missing.join(', ')}`);
  if (result.invalid.length > 0) parts.push(`Invalid: ${result.invalid.join(', ')}`);
  return `AI provider "anthropic" is not configured. ${parts.join('. ')}. Set ANTHROPIC_API_KEY to a Claude API key. ANTHROPIC_MODEL defaults to ${DEFAULT_ANTHROPIC_MODEL}.`;
}

export function describeAiIntegration(input: {
  provider: string | undefined;
  env: EnvSource;
  probe: AiProbeState | null;
}): AiIntegrationStatus {
  const selected = (input.provider ?? 'mock').trim() || 'mock';
  const base = { defaultModel: DEFAULT_ANTHROPIC_MODEL };

  if (selected === 'mock' || selected === 'local') {
    return {
      ...base,
      provider: 'mock',
      mode: 'demo',
      configuration: 'not_applicable',
      missing: [],
      invalid: [],
      connection: 'not_applicable',
      connectionDetail: 'Mock provider is active. Answers stay in the CRM and are not sent to Anthropic.',
      checkedAt: null,
      model: null,
    };
  }

  if (selected !== 'anthropic') {
    return {
      ...base,
      provider: 'other',
      mode: 'demo',
      configuration: 'invalid',
      missing: [],
      invalid: [],
      connection: 'failed',
      connectionDetail: `AI provider "${selected}" is not available. Use mock or anthropic.`,
      checkedAt: null,
      model: null,
    };
  }

  const parsed = parseAnthropicConfig(input.env);
  if (!parsed.ok) {
    return {
      ...base,
      provider: 'anthropic',
      mode: 'anthropic',
      configuration: parsed.reason,
      missing: parsed.missing,
      invalid: parsed.invalid,
      connection: 'untested',
      connectionDetail: 'Anthropic is selected, but the configuration is not valid, so the connection has not been tested.',
      checkedAt: null,
      model: null,
    };
  }

  const probe = input.probe;
  const connected = probe?.connection === 'connected';
  return {
    ...base,
    provider: 'anthropic',
    mode: 'anthropic',
    configuration: 'valid',
    missing: [],
    invalid: [],
    connection: connected ? 'connected' : probe?.connection === 'failed' ? 'failed' : 'untested',
    connectionDetail: probe?.detail ?? 'The API key and model are present. The connection has not been tested.',
    checkedAt: probe?.checkedAt ?? null,
    model: connected ? probe?.model ?? parsed.config.model : parsed.config.model,
  };
}
