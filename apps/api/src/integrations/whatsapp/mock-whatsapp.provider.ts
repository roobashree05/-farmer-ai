import { randomUUID } from 'crypto';
import type { DeliveryStatus, WhatsAppProvider } from './whatsapp.provider';

export class MockWhatsAppProvider implements WhatsAppProvider {
  private readonly sequence = new Map<string, DeliveryStatus[]>();
  private readonly cursor = new Map<string, number>();
  private readonly contacts = new Map<string, { phone: string; name?: string }>();

  async sendMessage(_input: { to: string; body: string }) {
    const providerMessageId = `mock-wa-${randomUUID()}`;
    this.sequence.set(providerMessageId, ['SENT', 'DELIVERED', 'READ']);
    this.cursor.set(providerMessageId, 0);
    return { providerMessageId, status: 'SENT' as const };
  }

  async sendTemplate(input: { to: string; templateName: string; variables: Record<string, string> }) {
    return this.sendMessage({ to: input.to, body: input.templateName });
  }

  async getContact(phone: string) {
    return this.contacts.get(phone) ?? { phone };
  }

  async getMessageStatus(providerMessageId: string): Promise<DeliveryStatus> {
    const sequence = this.sequence.get(providerMessageId) ?? ['FAILED'];
    const index = this.cursor.get(providerMessageId) ?? 0;
    const status = sequence[Math.min(index, sequence.length - 1)];
    this.cursor.set(providerMessageId, index + 1);
    return status;
  }

  async receiveMessage(input: { from: string; body: string }) {
    return { providerMessageId: `mock-in-${randomUUID()}`, body: input.body };
  }
}
