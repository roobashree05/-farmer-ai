import { Injectable } from '@nestjs/common';

export interface WhatsAppStreamEvent {
  type: 'message.created' | 'message.status';
  conversationId: string;
  messageId: string;
  status?: string;
}

@Injectable()
export class WhatsAppEvents {
  private readonly listeners = new Set<(event: WhatsAppStreamEvent) => void>();

  publish(event: WhatsAppStreamEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // One closed client must not stop the others.
      }
    }
  }

  subscribe(listener: (event: WhatsAppStreamEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
