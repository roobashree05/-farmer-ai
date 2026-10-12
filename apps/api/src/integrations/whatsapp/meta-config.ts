export const SUPPORTED_GRAPH_API_VERSIONS = ['v21.0', 'v22.0', 'v23.0', 'v24.0', 'v25.0', 'v26.0'] as const;

/** Cloud API send-messages guide still publishes v25.0. v26.0 is accepted because the Graph reference publishes it. */
export const RECOMMENDED_GRAPH_API_VERSION = 'v25.0';

export const META_CONFIG_KEYS = [
  'META_WABA_ID',
  'META_PHONE_NUMBER_ID',
  'META_ACCESS_TOKEN',
  'META_APP_SECRET',
  'META_GRAPH_API_VERSION',
  'META_WEBHOOK_VERIFY_TOKEN',
  'PUBLIC_BASE_URL',
] as const;

export type MetaConfigKey = (typeof META_CONFIG_KEYS)[number];

export interface EnvSource {
  get(key: string): string | undefined;
}

export interface MetaWhatsAppConfig {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  graphApiVersion: string;
  webhookVerifyToken: string;
  publicBaseUrl: string;
}

export type MetaConfigResult =
  | { ok: true; config: MetaWhatsAppConfig }
  | { ok: false; reason: 'missing' | 'invalid'; missing: MetaConfigKey[]; invalid: MetaConfigKey[] };

export interface WhatsAppProbeState {
  connection: 'untested' | 'connected' | 'failed' | 'not_applicable';
  detail: string;
  checkedAt: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
}

export interface WhatsAppIntegrationStatus {
  provider: 'mock' | 'meta' | 'other';
  mode: 'demo' | 'meta';
  demoMode: boolean;
  configuration: 'not_applicable' | 'valid' | 'missing' | 'invalid';
  missing: string[];
  invalid: string[];
  connection: 'not_applicable' | 'untested' | 'connected' | 'failed';
  connectionDetail: string | null;
  checkedAt: string | null;
  graphApiVersion: string | null;
  supportedGraphApiVersions: string[];
  recommendedGraphApiVersion: string;
  phoneNumberIdConfigured: boolean;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  webhookPath: '/api/webhooks/whatsapp';
  publicWebhookUrl: string | null;
}

const ID_PATTERN = /^\d{6,20}$/;

function blank(value: string | undefined): boolean {
  return !value || !value.trim();
}

export function parseMetaWhatsAppConfig(env: EnvSource): MetaConfigResult {
  const missing: MetaConfigKey[] = [];
  const invalid: MetaConfigKey[] = [];
  const read = (key: MetaConfigKey) => {
    const value = env.get(key);
    if (blank(value)) {
      missing.push(key);
      return '';
    }
    return value!.trim();
  };

  const wabaId = read('META_WABA_ID');
  const phoneNumberId = read('META_PHONE_NUMBER_ID');
  const accessToken = read('META_ACCESS_TOKEN');
  const appSecret = read('META_APP_SECRET');
  const graphApiVersion = read('META_GRAPH_API_VERSION');
  const webhookVerifyToken = read('META_WEBHOOK_VERIFY_TOKEN');
  const publicBaseUrl = read('PUBLIC_BASE_URL');

  if (wabaId && !ID_PATTERN.test(wabaId)) invalid.push('META_WABA_ID');
  if (phoneNumberId && !ID_PATTERN.test(phoneNumberId)) invalid.push('META_PHONE_NUMBER_ID');
  if (accessToken && (accessToken.length < 20 || /\s/.test(accessToken))) invalid.push('META_ACCESS_TOKEN');
  if (appSecret && (appSecret.length < 16 || /\s/.test(appSecret))) invalid.push('META_APP_SECRET');
  if (graphApiVersion && !SUPPORTED_GRAPH_API_VERSIONS.includes(graphApiVersion as (typeof SUPPORTED_GRAPH_API_VERSIONS)[number])) {
    invalid.push('META_GRAPH_API_VERSION');
  }
  if (webhookVerifyToken && (webhookVerifyToken.length < 8 || /\s/.test(webhookVerifyToken))) {
    invalid.push('META_WEBHOOK_VERIFY_TOKEN');
  }
  if (publicBaseUrl && !isAcceptablePublicUrl(publicBaseUrl)) invalid.push('PUBLIC_BASE_URL');

  if (missing.length > 0 || invalid.length > 0) {
    return { ok: false, reason: missing.length > 0 ? 'missing' : 'invalid', missing, invalid };
  }

  return {
    ok: true,
    config: {
      wabaId,
      phoneNumberId,
      accessToken,
      appSecret,
      graphApiVersion,
      webhookVerifyToken,
      publicBaseUrl: publicBaseUrl.replace(/\/$/, ''),
    },
  };
}

export function isAcceptablePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (url.protocol === 'http:') {
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    }
    return true;
  } catch {
    return false;
  }
}

export function webhookCallbackUrl(publicBaseUrl: string | null | undefined): string | null {
  if (!publicBaseUrl) return null;
  return `${publicBaseUrl.replace(/\/$/, '')}/api/webhooks/whatsapp`;
}

export function describeMetaConfigFailure(result: Extract<MetaConfigResult, { ok: false }>): string {
  const parts: string[] = [];
  if (result.missing.length > 0) parts.push(`Missing: ${result.missing.join(', ')}`);
  if (result.invalid.length > 0) parts.push(`Invalid: ${result.invalid.join(', ')}`);
  return `WhatsApp provider "meta" is not configured. ${parts.join('. ')}. Supported Graph API versions: ${SUPPORTED_GRAPH_API_VERSIONS.join(', ')}.`;
}

export function describeWhatsAppIntegration(input: {
  provider: string | undefined;
  demoMode: boolean;
  env: EnvSource;
  probe: WhatsAppProbeState | null;
}): WhatsAppIntegrationStatus {
  const selected = (input.provider ?? 'mock').trim() || 'mock';
  const base = {
    demoMode: input.demoMode,
    supportedGraphApiVersions: [...SUPPORTED_GRAPH_API_VERSIONS],
    recommendedGraphApiVersion: RECOMMENDED_GRAPH_API_VERSION,
    webhookPath: '/api/webhooks/whatsapp' as const,
  };

  if (selected === 'mock' || selected === 'local') {
    return {
      ...base,
      provider: 'mock',
      mode: 'demo',
      configuration: 'not_applicable',
      missing: [],
      invalid: [],
      connection: 'not_applicable',
      connectionDetail: 'Mock provider is active. Messages stay in the CRM and are not sent to Meta.',
      checkedAt: null,
      graphApiVersion: null,
      phoneNumberIdConfigured: false,
      displayPhoneNumber: null,
      verifiedName: null,
      publicWebhookUrl: null,
    };
  }

  if (selected !== 'meta') {
    return {
      ...base,
      provider: 'other',
      mode: 'demo',
      configuration: 'invalid',
      missing: [],
      invalid: [],
      connection: 'failed',
      connectionDetail: `WhatsApp provider "${selected}" is not available.`,
      checkedAt: null,
      graphApiVersion: null,
      phoneNumberIdConfigured: false,
      displayPhoneNumber: null,
      verifiedName: null,
      publicWebhookUrl: null,
    };
  }

  const parsed = parseMetaWhatsAppConfig(input.env);
  if (!parsed.ok) {
    return {
      ...base,
      provider: 'meta',
      mode: 'meta',
      configuration: parsed.reason,
      missing: parsed.missing,
      invalid: parsed.invalid,
      connection: 'untested',
      connectionDetail: 'Meta is selected, but the configuration is not valid, so the connection has not been tested.',
      checkedAt: null,
      graphApiVersion: null,
      phoneNumberIdConfigured: parsed.missing.includes('META_PHONE_NUMBER_ID') ? false : !parsed.invalid.includes('META_PHONE_NUMBER_ID') && Boolean(input.env.get('META_PHONE_NUMBER_ID')?.trim()),
      displayPhoneNumber: null,
      verifiedName: null,
      publicWebhookUrl: null,
    };
  }

  const probe = input.probe;
  const connected = probe?.connection === 'connected';
  return {
    ...base,
    provider: 'meta',
    mode: 'meta',
    configuration: 'valid',
    missing: [],
    invalid: [],
    connection: connected ? 'connected' : probe?.connection === 'failed' ? 'failed' : 'untested',
    connectionDetail: probe?.detail ?? 'Credentials are present and the Graph API version is valid. The connection has not been tested.',
    checkedAt: probe?.checkedAt ?? null,
    graphApiVersion: parsed.config.graphApiVersion,
    phoneNumberIdConfigured: true,
    displayPhoneNumber: connected ? probe?.displayPhoneNumber ?? null : null,
    verifiedName: connected ? probe?.verifiedName ?? null : null,
    publicWebhookUrl: webhookCallbackUrl(parsed.config.publicBaseUrl),
  };
}
