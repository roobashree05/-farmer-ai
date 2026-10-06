export type DeliveryStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface WhatsAppProvider {
  sendMessage(input: { to: string; body: string }): Promise<{ providerMessageId: string; status: 'SENT' }>;
  sendTemplate(input: {
    to: string;
    templateName: string;
    variables: Record<string, string>;
  }): Promise<{ providerMessageId: string; status: 'SENT' }>;
  getContact(phone: string): Promise<{ phone: string; name?: string } | null>;
  getMessageStatus(providerMessageId: string): Promise<DeliveryStatus>;
  receiveMessage(input: { from: string; body: string }): Promise<{ providerMessageId: string; body: string }>;
}
