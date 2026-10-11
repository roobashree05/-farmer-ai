import { normalizePhone } from '@aijewel/shared';

export const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

const STATUS_ORDER = ['PENDING', 'SENT', 'DELIVERED', 'READ'] as const;
type RankedStatus = (typeof STATUS_ORDER)[number];

export type WhatsAppDeliveryUpdate = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface InboundWebhookMessage {
  kind: 'message';
  wabaId: string | null;
  phoneNumberId: string | null;
  from: string;
  profileName: string | null;
  providerMessageId: string;
  timestamp: string | null;
  body: string;
  messageType: string;
}

export interface StatusWebhookEvent {
  kind: 'status';
  wabaId: string | null;
  phoneNumberId: string | null;
  providerMessageId: string;
  status: WhatsAppDeliveryUpdate;
  timestamp: string | null;
  recipient: string | null;
  errorCode: string | null;
  errorDetail: string | null;
}

export type WhatsAppWebhookEvent = InboundWebhookMessage | StatusWebhookEvent;

export function toWhatsAppRecipient(raw: string): string | null {
  const normalized = normalizePhone(raw);
  if (!normalized) return null;
  const digits = normalized.slice(1);
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export function sessionWindowOpen(lastInboundAt: Date | null, now: Date): boolean {
  if (!lastInboundAt) return false;
  const elapsed = now.getTime() - lastInboundAt.getTime();
  return elapsed >= 0 && elapsed < WHATSAPP_SESSION_WINDOW_MS;
}

export function nextMessageStatus(current: string, incoming: string): WhatsAppDeliveryUpdate | null {
  if (incoming !== 'SENT' && incoming !== 'DELIVERED' && incoming !== 'READ' && incoming !== 'FAILED') return null;
  if (current === 'FAILED' || current === 'READ') return null;
  if (incoming === 'FAILED') return 'FAILED';
  const currentRank = STATUS_ORDER.indexOf(current as RankedStatus);
  const nextRank = STATUS_ORDER.indexOf(incoming as RankedStatus);
  if (currentRank < 0 || nextRank < 0 || nextRank <= currentRank) return null;
  return incoming;
}

export function whatsAppTimestampToDate(timestamp: string | null, now = new Date()): Date {
  if (!timestamp || !/^\d{10,13}$/.test(timestamp)) return now;
  const numeric = Number(timestamp);
  const millis = timestamp.length >= 13 ? numeric : numeric * 1000;
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return now;
  if (Math.abs(now.getTime() - date.getTime()) > 7 * 24 * 60 * 60 * 1000) return now;
  return date;
}

export function whatsAppClientStatus(status: number): number {
  if (status === 401 || status === 403) return 502;
  if (status >= 400 && status < 600) return status;
  return 502;
}

export function sanitizeProviderMessage(message: string): string {
  return message.replace(/bearer\s+\S+/gi, 'bearer [redacted]').replace(/EAA[A-Za-z0-9]+/g, '[redacted]').slice(0, 300);
}

export function parseWhatsAppWebhook(payload: unknown): WhatsAppWebhookEvent[] {
  const root = asRecord(payload);
  if (!root || root.object !== 'whatsapp_business_account' || !Array.isArray(root.entry)) return [];
  const events: WhatsAppWebhookEvent[] = [];
  for (const entry of root.entry) {
    const entryRecord = asRecord(entry);
    if (!entryRecord) continue;
    const wabaId = asString(entryRecord.id);
    const changes = Array.isArray(entryRecord.changes) ? entryRecord.changes : [];
    for (const change of changes) {
      const changeRecord = asRecord(change);
      const value = asRecord(changeRecord?.value);
      if (!value) continue;
      const metadata = asRecord(value.metadata);
      const phoneNumberId = asString(metadata?.phone_number_id);
      const profileName = profileFromContacts(value.contacts);
      if (Array.isArray(value.messages)) {
        for (const message of value.messages) {
          const parsed = parseInbound(message, wabaId, phoneNumberId, profileName);
          if (parsed) events.push(parsed);
        }
      }
      if (Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          const parsed = parseStatus(status, wabaId, phoneNumberId);
          if (parsed) events.push(parsed);
        }
      }
    }
  }
  return events;
}

function parseInbound(
  message: unknown,
  wabaId: string | null,
  phoneNumberId: string | null,
  profileName: string | null,
): InboundWebhookMessage | null {
  const record = asRecord(message);
  if (!record) return null;
  const from = asString(record.from);
  const providerMessageId = asString(record.id);
  if (!from || !providerMessageId) return null;
  const content = inboundContent(record);
  return {
    kind: 'message',
    wabaId,
    phoneNumberId,
    from,
    profileName,
    providerMessageId,
    timestamp: asTimestamp(record.timestamp),
    body: content.body,
    messageType: content.messageType,
  };
}

function parseStatus(status: unknown, wabaId: string | null, phoneNumberId: string | null): StatusWebhookEvent | null {
  const record = asRecord(status);
  if (!record) return null;
  const providerMessageId = asString(record.id);
  const mapped = mapStatus(asString(record.status));
  if (!providerMessageId || !mapped) return null;
  const error = firstError(record.errors);
  return {
    kind: 'status',
    wabaId,
    phoneNumberId,
    providerMessageId,
    status: mapped,
    timestamp: asTimestamp(record.timestamp),
    recipient: asString(record.recipient_id),
    errorCode: error.code,
    errorDetail: error.detail,
  };
}

function inboundContent(record: Record<string, unknown>): { body: string; messageType: string } {
  const messageType = asString(record.type) ?? 'unknown';
  if (messageType === 'text') {
    const text = asString(asRecord(record.text)?.body);
    if (text) return { body: text, messageType };
  }
  if (messageType === 'button') {
    const text = asString(asRecord(record.button)?.text);
    if (text) return { body: text, messageType };
  }
  if (messageType === 'interactive') {
    const interactive = asRecord(record.interactive);
    const title =
      asString(asRecord(interactive?.button_reply)?.title) ?? asString(asRecord(interactive?.list_reply)?.title);
    if (title) return { body: title, messageType };
  }
  if (messageType === 'reaction') {
    const emoji = asString(asRecord(record.reaction)?.emoji);
    return { body: emoji ? `[reaction] ${emoji}` : '[reaction]', messageType };
  }
  const media = asRecord(record[messageType]);
  const caption = asString(media?.caption);
  if (caption) return { body: caption, messageType };
  return { body: `[${messageType}]`, messageType };
}

function mapStatus(status: string | null): WhatsAppDeliveryUpdate | null {
  if (status === 'sent') return 'SENT';
  if (status === 'delivered') return 'DELIVERED';
  if (status === 'read') return 'READ';
  if (status === 'failed') return 'FAILED';
  return null;
}

function firstError(value: unknown): { code: string | null; detail: string | null } {
  if (!Array.isArray(value) || value.length === 0) return { code: null, detail: null };
  const error = asRecord(value[0]);
  if (!error) return { code: null, detail: null };
  const code = error.code === undefined || error.code === null ? null : String(error.code);
  const detail = asString(error.title) ?? asString(error.message);
  return { code, detail: detail ? sanitizeProviderMessage(detail) : null };
}

function profileFromContacts(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const contact of value) {
    const name = asString(asRecord(asRecord(contact)?.profile)?.name);
    if (name) return name;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === 'string' && /^\d{10,13}$/.test(value)) return value;
  return null;
}
