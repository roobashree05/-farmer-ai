import type { WhatsAppProbeState } from './meta-config';

export type DeliveryStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface WhatsAppProvider {
  readonly mode: 'mock' | 'meta';
  sendMessage(input: { to: string; body: string }): Promise<{ providerMessageId: string; status: 'SENT' }>;
  sendTemplate(input: {
    to: string;
    templateName: string;
    language?: string;
    variables: Record<string, string>;
  }): Promise<{ providerMessageId: string; status: 'SENT' }>;
  getContact(phone: string): Promise<{ phone: string; name?: string } | null>;
  getMessageStatus(providerMessageId: string): Promise<DeliveryStatus>;
  receiveMessage(input: { from: string; body: string }): Promise<{ providerMessageId: string; body: string }>;
  connectionState(): WhatsAppProbeState | null;
  probeConnection(): Promise<WhatsAppProbeState>;
}
