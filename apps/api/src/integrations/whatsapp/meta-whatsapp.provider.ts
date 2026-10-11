import { log } from '../../common/logger';
import type { MetaWhatsAppConfig, WhatsAppProbeState } from './meta-config';
import { sanitizeProviderMessage, toWhatsAppRecipient } from './meta-payload';
import type { DeliveryStatus, WhatsAppProvider } from './whatsapp.provider';

export class WhatsAppApiError extends Error {
  constructor(
    readonly errorCode: string,
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

const TEMPLATE_NAME = /^[a-zA-Z0-9_]{1,512}$/;

export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly mode = 'meta' as const;
  private probeState: WhatsAppProbeState = {
    connection: 'untested',
    detail: 'Credentials are present and the Graph API version is valid. The connection has not been tested.',
    checkedAt: null,
    displayPhoneNumber: null,
    verifiedName: null,
  };

  constructor(
    private readonly config: MetaWhatsAppConfig,
    private readonly http: typeof fetch = fetch,
  ) {}

  connectionState(): WhatsAppProbeState {
    return this.probeState;
  }

  async probeConnection(): Promise<WhatsAppProbeState> {
    const checkedAt = new Date().toISOString();
    try {
      const body = await this.request(
        'GET',
        `/${this.config.phoneNumberId}?fields=id,display_phone_number,verified_name`,
      );
      const id = typeof body.id === 'string' ? body.id : '';
      if (id !== this.config.phoneNumberId) {
        this.probeState = {
          connection: 'failed',
          detail: 'Meta responded, but the phone number id did not match META_PHONE_NUMBER_ID.',
          checkedAt,
          displayPhoneNumber: null,
          verifiedName: null,
        };
        return this.probeState;
      }
      this.probeState = {
        connection: 'connected',
        detail: 'Meta accepted the access token for the configured phone number.',
        checkedAt,
        displayPhoneNumber: typeof body.display_phone_number === 'string' ? body.display_phone_number : null,
        verifiedName: typeof body.verified_name === 'string' ? body.verified_name : null,
      };
      return this.probeState;
    } catch (error) {
      const detail = error instanceof WhatsAppApiError ? error.message : 'Meta could not be reached.';
      this.probeState = {
        connection: 'failed',
        detail,
        checkedAt,
        displayPhoneNumber: null,
        verifiedName: null,
      };
      return this.probeState;
    }
  }

  async sendMessage(input: { to: string; body: string }) {
    const to = this.requireRecipient(input.to);
    const body = await this.request('POST', `/${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: input.body },
    });
    return { providerMessageId: this.messageId(body), status: 'SENT' as const };
  }

  async sendTemplate(input: { to: string; templateName: string; language?: string; variables?: Record<string, string> }) {
    const to = this.requireRecipient(input.to);
    if (!TEMPLATE_NAME.test(input.templateName)) {
      throw new WhatsAppApiError('VALIDATION_ERROR', 'Template name must use letters, numbers, and underscores', 400);
    }
    const language = input.language?.trim() || 'en';
    if (!/^[a-zA-Z]{2}(?:_[a-zA-Z]{2})?$/.test(language)) {
      throw new WhatsAppApiError('VALIDATION_ERROR', 'Template language must look like en or en_US', 400);
    }
    const parameters = templateParameters(input.variables);
    const template: Record<string, unknown> = {
      name: input.templateName,
      language: { code: language },
    };
    if (parameters) {
      template.components = [{ type: 'body', parameters }];
    }
    const body = await this.request('POST', `/${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template,
    });
    return { providerMessageId: this.messageId(body), status: 'SENT' as const };
  }

  async getContact(phone: string) {
    const recipient = toWhatsAppRecipient(phone);
    return recipient ? { phone: `+${recipient}` } : null;
  }

  /**
   * Meta does not offer a message-status pull that means delivered.
   * Delivery and read arrive on the webhook. This stays SENT so a poll cannot invent them.
   */
  async getMessageStatus(_providerMessageId: string): Promise<DeliveryStatus> {
    return 'SENT';
  }

  async receiveMessage(): Promise<{ providerMessageId: string; body: string }> {
    throw new WhatsAppApiError('WHATSAPP_WEBHOOK_REQUIRED', 'Inbound WhatsApp messages arrive through the Meta webhook', 409);
  }

  private requireRecipient(phone: string): string {
    const to = toWhatsAppRecipient(phone);
    if (!to) throw new WhatsAppApiError('INVALID_PHONE', 'Recipient phone number is not valid', 400);
    return to;
  }

  private messageId(body: Record<string, unknown>): string {
    const messages = body.messages;
    const first = Array.isArray(messages) ? messages[0] : null;
    const id = first && typeof first === 'object' ? (first as { id?: unknown }).id : null;
    if (typeof id !== 'string' || !id) {
      throw new WhatsAppApiError('WHATSAPP_REJECTED', 'Meta accepted the request without a WhatsApp message id', 502);
    }
    return id;
  }

  private async request(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<Record<string, unknown>> {
    const url = `https://graph.facebook.com/${this.config.graphApiVersion}${path}`;
    let response: Response;
    try {
      response = await this.http(url, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          ...(payload ? { 'Content-Type': 'application/json' } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });
    } catch (error) {
      if (isTimeout(error)) {
        throw new WhatsAppApiError('WHATSAPP_TIMEOUT', 'Meta did not respond in time', 504);
      }
      throw new WhatsAppApiError('WHATSAPP_UNAVAILABLE', 'Meta could not be reached', 502);
    }
    return this.readResponse(response);
  }

  private async readResponse(response: Response): Promise<Record<string, unknown>> {
    const json = await readJson(response);
    if (response.ok && json && typeof json === 'object') return json as Record<string, unknown>;
    if (response.ok) return {};
    const meta = extractMetaError(json);
    log('warn', 'WhatsApp API request failed', {
      statusCode: response.status,
      metaCode: meta.code,
      fbtraceId: meta.fbtraceId,
    });
    const retryAfter = Number(response.headers.get('retry-after'));
    if (response.status === 429 || meta.code === 4 || meta.code === 80007 || meta.code === 130429) {
      throw new WhatsAppApiError(
        'WHATSAPP_RATE_LIMITED',
        'WhatsApp rate limit reached. Try again later.',
        429,
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    }
    if (response.status === 401 || response.status === 403 || meta.code === 190) {
      throw new WhatsAppApiError('WHATSAPP_AUTH_FAILED', 'Meta rejected the access token', 401);
    }
    throw new WhatsAppApiError(
      'WHATSAPP_REJECTED',
      sanitizeProviderMessage(meta.message || `Meta returned HTTP ${response.status}`),
      response.status >= 400 && response.status < 600 ? response.status : 502,
    );
  }
}

function templateParameters(variables: Record<string, string> | undefined) {
  if (!variables) return null;
  const parameters = Object.values(variables).map((value) => {
    if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value) || value.length > 1024) {
      throw new WhatsAppApiError('VALIDATION_ERROR', 'Template variables must be a single line under 1024 characters', 400);
    }
    return { type: 'text' as const, text: value };
  });
  return parameters.length > 0 ? parameters : null;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractMetaError(json: unknown): { message: string; code: number | null; fbtraceId: string | null } {
  const error = json && typeof json === 'object' && 'error' in json ? (json as { error?: unknown }).error : null;
  if (!error || typeof error !== 'object') return { message: '', code: null, fbtraceId: null };
  const record = error as { message?: unknown; code?: unknown; fbtrace_id?: unknown };
  return {
    message: typeof record.message === 'string' ? record.message : '',
    code: typeof record.code === 'number' ? record.code : null,
    fbtraceId: typeof record.fbtrace_id === 'string' ? record.fbtrace_id : null,
  };
}
