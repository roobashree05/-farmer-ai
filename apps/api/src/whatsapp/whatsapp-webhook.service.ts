import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizePhone } from '@aijewel/shared';
import { AppException } from '../common/app.exception';
import { log } from '../common/logger';
import { webhookChallenge, verifyWebhookSignature } from '../integrations/whatsapp/meta-signature';
import {
  nextMessageStatus,
  parseWhatsAppWebhook,
  whatsAppTimestampToDate,
  type WhatsAppWebhookEvent,
} from '../integrations/whatsapp/meta-payload';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WhatsAppEvents } from './whatsapp-events';

@Injectable()
export class WhatsAppWebhookService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: WhatsAppEvents,
  ) {}

  verifySubscription(query: Record<string, unknown>): string {
    const expected = this.config.get<string>('META_WEBHOOK_VERIFY_TOKEN')?.trim();
    if (!expected) {
      throw new AppException('WEBHOOK_NOT_CONFIGURED', 'META_WEBHOOK_VERIFY_TOKEN is not configured', 503);
    }
    const challenge = webhookChallenge(query, expected);
    if (!challenge) {
      throw new AppException('WEBHOOK_VERIFICATION_FAILED', 'Webhook verification failed', 403);
    }
    return challenge;
  }

  async receive(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = this.config.get<string>('META_APP_SECRET')?.trim();
    if (!secret) {
      throw new AppException('WEBHOOK_NOT_CONFIGURED', 'META_APP_SECRET is not configured', 503);
    }
    if (!rawBody || rawBody.length === 0) {
      throw new AppException('VALIDATION_ERROR', 'Webhook body is required', 400);
    }
    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      throw new AppException('WEBHOOK_SIGNATURE_INVALID', 'Webhook signature is invalid', 403);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new AppException('VALIDATION_ERROR', 'Webhook body must be JSON', 400);
    }
    const summary = await this.apply(parseWhatsAppWebhook(payload));
    log('info', 'WhatsApp webhook processed', summary);
    return summary;
  }

  private async apply(events: WhatsAppWebhookEvent[]) {
    let accepted = 0;
    let ignored = 0;
    for (const event of events) {
      if (!this.matchesAccount(event)) {
        ignored += 1;
        continue;
      }
      const result = event.kind === 'message' ? await this.ingestMessage(event) : await this.applyStatus(event);
      if (result) accepted += 1;
      else ignored += 1;
    }
    return { accepted, ignored };
  }

  private matchesAccount(event: WhatsAppWebhookEvent): boolean {
    const phoneNumberId = this.config.get<string>('META_PHONE_NUMBER_ID')?.trim();
    const wabaId = this.config.get<string>('META_WABA_ID')?.trim();
    if (phoneNumberId && event.phoneNumberId && event.phoneNumberId !== phoneNumberId) return false;
    if (wabaId && event.wabaId && event.wabaId !== wabaId) return false;
    return true;
  }

  private async ingestMessage(event: Extract<WhatsAppWebhookEvent, { kind: 'message' }>) {
    const existing = await this.prisma.whatsAppMessage.findUnique({ where: { providerMessageId: event.providerMessageId } });
    if (existing) return false;
    const conversation = await this.resolveConversation(event.from, event.profileName);
    if (!conversation) return false;
    const createdAt = whatsAppTimestampToDate(event.timestamp);
    try {
      const message = await this.prisma.whatsAppMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          body: event.body,
          status: 'DELIVERED',
          messageType: event.messageType,
          providerMessageId: event.providerMessageId,
          createdAt,
          statusEvents: [{ status: 'DELIVERED', at: createdAt.toISOString(), source: 'webhook' }],
        },
      });
      await this.prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: createdAt },
      });
      await this.prisma.lead.update({
        where: { id: conversation.leadId },
        data: { lastContactAt: createdAt },
      });
      await this.prisma.leadActivity.create({
        data: {
          leadId: conversation.leadId,
          type: 'WHATSAPP_RECEIVED',
          summary: 'WhatsApp reply received',
        },
      });
      await this.notifyInbound(conversation.lead.assignedUserId, conversation.lead.name, conversation.id, event.body);
      this.events.publish({ type: 'message.created', conversationId: conversation.id, messageId: message.id, status: message.status });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
      throw error;
    }
  }

  private async applyStatus(event: Extract<WhatsAppWebhookEvent, { kind: 'status' }>) {
    const message = await this.findForStatus(event.providerMessageId);
    if (!message) return false;
    const next = nextMessageStatus(message.status, event.status);
    if (!next) return false;
    const history = Array.isArray(message.statusEvents) ? [...message.statusEvents] : [];
    const at = whatsAppTimestampToDate(event.timestamp).toISOString();
    history.push({ status: next, at, source: 'webhook', errorCode: event.errorCode });
    await this.prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: next,
        errorCode: event.errorCode ?? undefined,
        statusEvents: history,
      },
    });
    this.events.publish({ type: 'message.status', conversationId: message.conversationId, messageId: message.id, status: next });
    return true;
  }

  private async findForStatus(providerMessageId: string) {
    const immediate = await this.prisma.whatsAppMessage.findUnique({ where: { providerMessageId } });
    if (immediate) return immediate;
    await new Promise((resolve) => setTimeout(resolve, 200));
    return this.prisma.whatsAppMessage.findUnique({ where: { providerMessageId } });
  }

  private async resolveConversation(from: string, profileName: string | null) {
    const normalized = normalizePhone(from);
    if (!normalized) return null;
    const phones = [normalized, normalized.slice(1)];
    const existing = await this.prisma.whatsAppConversation.findFirst({
      where: { contactPhone: { in: phones } },
      orderBy: { lastMessageAt: 'desc' },
      include: { lead: true },
    });
    if (existing) return existing;
    const lead = await this.prisma.lead.findFirst({
      where: {
        deletedAt: null,
        OR: [{ phone: { in: phones } }, { whatsappNumber: { in: phones } }],
      },
      orderBy: { lastContactAt: 'desc' },
    });
    const resolved = lead ?? (await this.createInboundLead(normalized, profileName));
    if (!resolved) return null;
    return this.prisma.whatsAppConversation.create({
      data: { leadId: resolved.id, contactPhone: resolved.whatsappNumber || resolved.phone },
      include: { lead: true },
    });
  }

  private async createInboundLead(phone: string, profileName: string | null) {
    const status = await this.prisma.leadStatusDefinition.findUnique({ where: { code: 'NEW' } });
    const source =
      (await this.prisma.leadSource.findUnique({ where: { code: 'WHATSAPP_GROUP' } })) ??
      (await this.prisma.leadSource.findUnique({ where: { code: 'MANUAL' } }));
    if (!status || !source) {
      log('error', 'WhatsApp inbound lead could not be created', { reason: 'missing status or source' });
      return null;
    }
    const name = profileName?.slice(0, 120) || `WhatsApp ${phone.slice(-4)}`;
    try {
      return await this.prisma.lead.create({
        data: {
          name,
          phone,
          whatsappNumber: phone,
          leadSourceId: source.id,
          statusId: status.id,
          activities: { create: { type: 'LEAD_CREATED', summary: 'Lead created from an inbound WhatsApp message' } },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.lead.findFirst({ where: { phone, deletedAt: null } });
      }
      throw error;
    }
  }

  private async notifyInbound(assignedUserId: string | null, leadName: string, conversationId: string, body: string) {
    const input = {
      type: 'WHATSAPP_MESSAGE',
      title: 'New WhatsApp reply',
      body: `${leadName}: ${body.slice(0, 180)}`,
      entityType: 'WhatsAppConversation',
      entityId: conversationId,
    };
    if (assignedUserId) {
      await this.notifications.notifyUser(assignedUserId, input);
      return;
    }
    await this.notifications.notifyRole('ADMIN', input);
  }
}
