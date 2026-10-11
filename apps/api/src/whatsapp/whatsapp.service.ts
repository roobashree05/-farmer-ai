import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { normalizePhone } from '@aijewel/shared';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { pageArgs } from '../common/page.dto';
import type { AIProvider } from '../integrations/ai/ai.provider';
import { describeWhatsAppIntegration } from '../integrations/whatsapp/meta-config';
import { sessionWindowOpen, toWhatsAppRecipient, whatsAppClientStatus } from '../integrations/whatsapp/meta-payload';
import { WhatsAppApiError } from '../integrations/whatsapp/meta-whatsapp.provider';
import { AI_PROVIDER, WHATSAPP_PROVIDER } from '../integrations/tokens';
import type { DeliveryStatus, WhatsAppProvider } from '../integrations/whatsapp/whatsapp.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppEvents } from './whatsapp-events';

export interface OutboundMessageInput {
  body?: string;
  templateName?: string;
  templateLanguage?: string;
  variables?: Record<string, string>;
  idempotencyKey?: string;
}

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
    private readonly config: ConfigService,
    private readonly events: WhatsAppEvents,
  ) {}

  async listConversations(query: { page?: number; pageSize?: number; q?: string }) {
    const { page, pageSize, skip, take } = pageArgs(query);
    const q = query.q?.trim();
    const where: Prisma.WhatsAppConversationWhereInput = q
      ? {
          OR: [
            { contactPhone: { contains: q } },
            { lead: { name: { contains: q, mode: 'insensitive' } } },
            { lead: { shopName: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.whatsAppConversation.count({ where }),
      this.prisma.whatsAppConversation.findMany({
        where,
        skip,
        take,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          lead: { select: { id: true, name: true, shopName: true, displayId: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        leadId: item.leadId,
        leadName: item.lead.name,
        shopName: item.lead.shopName,
        displayId: item.lead.displayId,
        contactPhone: item.contactPhone,
        lastMessageAt: item.lastMessageAt?.toISOString() ?? null,
        preview: item.messages[0]?.body ?? '',
      })),
      page,
      pageSize,
      total,
    };
  }

  async openConversation(leadId: string, actor: Actor) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, deletedAt: null } });
    if (!lead) throw new AppException('LEAD_NOT_FOUND', 'Lead was not found', 404);
    const phone = lead.whatsappNumber || lead.phone;
    const existing = await this.prisma.whatsAppConversation.findFirst({
      where: { leadId, contactPhone: phone },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (existing) return this.presentConversation(existing);
    const created = await this.prisma.whatsAppConversation.create({
      data: { leadId, contactPhone: phone },
      include: { messages: true },
    });
    await this.whatsapp.getContact(phone);
    await this.audit.record({
      userId: actor.id,
      action: 'WHATSAPP_CONVERSATION_OPENED',
      entity: 'WhatsAppConversation',
      entityId: created.id,
    });
    return this.presentConversation(created);
  }

  async getConversation(id: string) {
    const conversation = await this.prisma.whatsAppConversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        lead: { select: { id: true, name: true, shopName: true } },
      },
    });
    if (!conversation) throw new AppException('CONVERSATION_NOT_FOUND', 'Conversation was not found', 404);
    return this.presentConversation(conversation);
  }

  connectionReport() {
    return describeWhatsAppIntegration({
      provider: this.config.get<string>('WHATSAPP_PROVIDER'),
      demoMode: this.config.get('DEMO_MODE', 'false') === 'true',
      env: this.config,
      probe: this.whatsapp.connectionState(),
    });
  }

  async testConnection(actor: Actor) {
    const before = this.connectionReport();
    if (before.provider !== 'meta') {
      throw new AppException('WHATSAPP_PROVIDER_MOCK', 'A Meta connection test runs only when WHATSAPP_PROVIDER=meta', 409);
    }
    if (before.configuration !== 'valid') {
      throw new AppException('PROVIDER_NOT_CONFIGURED', 'Meta WhatsApp configuration is incomplete', 409);
    }
    await this.whatsapp.probeConnection();
    const report = this.connectionReport();
    await this.audit.record({
      userId: actor.id,
      action: 'WHATSAPP_CONNECTION_TESTED',
      entity: 'WhatsApp',
      entityId: 'meta',
      after: {
        connection: report.connection,
        configuration: report.configuration,
        graphApiVersion: report.graphApiVersion,
      },
    });
    return report;
  }

  async sendMessage(conversationId: string, input: OutboundMessageInput, actor: Actor) {
    const text = input.body?.trim() ?? '';
    const templateName = input.templateName?.trim() ?? '';
    if (this.whatsapp.mode === 'mock') {
      if (!text && !templateName) throw new AppException('VALIDATION_ERROR', 'Message is required', 400);
      return this.sendMockMessage(conversationId, text || templateName, actor);
    }
    return this.sendLiveMessage(conversationId, { ...input, body: text, templateName }, actor);
  }

  private async sendMockMessage(conversationId: string, body: string, actor: Actor) {
    const text = body.trim();
    if (!text) throw new AppException('VALIDATION_ERROR', 'Message is required', 400);
    const conversation = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      include: { lead: true },
    });
    if (!conversation) throw new AppException('CONVERSATION_NOT_FOUND', 'Conversation was not found', 404);
    const sent = await this.whatsapp.sendMessage({ to: conversation.contactPhone, body: text });
    const events: { status: DeliveryStatus; at: string }[] = [{ status: 'SENT', at: new Date().toISOString() }];
    let status: DeliveryStatus = 'SENT';
    for (let step = 0; step < 3; step += 1) {
      status = await this.whatsapp.getMessageStatus(sent.providerMessageId);
      events.push({ status, at: new Date().toISOString() });
      if (status === 'READ' || status === 'FAILED') break;
    }
    const outbound = await this.prisma.whatsAppMessage.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        body: text,
        status,
        providerMessageId: sent.providerMessageId,
        statusEvents: events,
      },
    });
    const simulated = await this.whatsapp.receiveMessage({
      from: conversation.contactPhone,
      body: 'Thanks. What warranty do you provide for AIJewel?',
    });
    const inbound = await this.prisma.whatsAppMessage.create({
      data: {
        conversationId,
        direction: 'INBOUND',
        body: simulated.body,
        status: 'READ',
        providerMessageId: simulated.providerMessageId,
      },
    });
    const documents = await this.activeDocuments();
    const answer = await this.ai.generateResponse({ message: simulated.body, documents });
    const aiOutbound = await this.prisma.whatsAppMessage.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        body: answer.text,
        status: 'READ',
        providerMessageId: (await this.whatsapp.sendMessage({ to: conversation.contactPhone, body: answer.text })).providerMessageId,
      },
    });
    const aiConversation = await this.prisma.aIConversation.create({
      data: {
        leadId: conversation.leadId,
        channel: 'WHATSAPP',
        messages: {
          create: [
            { role: 'USER', content: simulated.body },
            {
              role: 'ASSISTANT',
              content: answer.text,
              confidence: answer.confidence,
              escalateToHuman: answer.escalateToHuman,
              sources: answer.sources,
            },
          ],
        },
      },
    });
    if (answer.escalateToHuman) {
      const ownerId = conversation.lead.assignedUserId ?? actor.id;
      await this.prisma.followUp.create({
        data: {
          leadId: conversation.leadId,
          userId: ownerId,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          notes: 'AI could not answer a WhatsApp question from the knowledge base.',
        },
      });
      await this.notifications.notifyUser(ownerId, {
        type: 'CUSTOMER_RESPONSE',
        title: 'WhatsApp needs a person',
        body: `${conversation.lead.name} asked something the knowledge base could not answer.`,
        entityType: 'Lead',
        entityId: conversation.leadId,
      });
    }
    await this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
    await this.prisma.lead.update({ where: { id: conversation.leadId }, data: { lastContactAt: new Date() } });
    await this.prisma.leadActivity.createMany({
      data: [
        { leadId: conversation.leadId, userId: actor.id, type: 'WHATSAPP_SENT', summary: 'WhatsApp message sent' },
        { leadId: conversation.leadId, userId: actor.id, type: 'WHATSAPP_RECEIVED', summary: 'Simulated customer reply received' },
        { leadId: conversation.leadId, userId: actor.id, type: 'AI_RESPONSE', summary: 'AI response generated from the knowledge base' },
      ],
    });
    await this.notifications.notifyUser(conversation.lead.assignedUserId ?? actor.id, {
      type: 'WHATSAPP_MESSAGE',
      title: 'New WhatsApp reply',
      body: simulated.body,
      entityType: 'WhatsAppConversation',
      entityId: conversationId,
    });
    this.events.publish({ type: 'message.created', conversationId, messageId: outbound.id, status: outbound.status });
    this.events.publish({ type: 'message.created', conversationId, messageId: inbound.id, status: inbound.status });
    this.events.publish({ type: 'message.created', conversationId, messageId: aiOutbound.id, status: aiOutbound.status });
    return {
      outbound: this.presentMessage(outbound),
      inbound: this.presentMessage(inbound),
      ai: { ...this.presentMessage(aiOutbound), confidence: answer.confidence, escalateToHuman: answer.escalateToHuman },
      aiConversationId: aiConversation.id,
    };
  }

  private async sendLiveMessage(
    conversationId: string,
    input: OutboundMessageInput & { body: string; templateName: string },
    actor: Actor,
  ) {
    const templateName = input.templateName;
    const text = input.body;
    if (!text && !templateName) throw new AppException('VALIDATION_ERROR', 'Message is required', 400);
    if (text && text.length > 4096) {
      throw new AppException('VALIDATION_ERROR', 'WhatsApp text messages are limited to 4096 characters', 400);
    }
    if (templateName && !/^[a-zA-Z0-9_]{1,512}$/.test(templateName)) {
      throw new AppException('VALIDATION_ERROR', 'Template name must use letters, numbers, and underscores', 400);
    }
    if (templateName && input.templateLanguage && !/^[a-zA-Z]{2}(?:_[a-zA-Z]{2})?$/.test(input.templateLanguage.trim())) {
      throw new AppException('VALIDATION_ERROR', 'Template language must look like en or en_US', 400);
    }
    if (input.variables) {
      for (const value of Object.values(input.variables)) {
        if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value) || value.length > 1024) {
          throw new AppException('VALIDATION_ERROR', 'Template variables must be a single line under 1024 characters', 400);
        }
      }
    }
    const conversation = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      include: { lead: true },
    });
    if (!conversation) throw new AppException('CONVERSATION_NOT_FOUND', 'Conversation was not found', 404);
    const recipient = toWhatsAppRecipient(conversation.contactPhone);
    if (!recipient || !normalizePhone(conversation.contactPhone)) {
      throw new AppException('INVALID_PHONE', 'Recipient phone number is not valid', 400);
    }
    const idempotencyKey = input.idempotencyKey?.trim() || undefined;
    if (idempotencyKey) {
      const existing = await this.prisma.whatsAppMessage.findUnique({
        where: { conversationId_idempotencyKey: { conversationId, idempotencyKey } },
      });
      if (existing) return { outbound: this.presentMessage(existing), inbound: null, ai: null, duplicate: true };
    }
    const preview = templateName ? templatePreview(templateName, input.variables) : text;
    if (!templateName) {
      const recent = await this.prisma.whatsAppMessage.findFirst({
        where: {
          conversationId,
          direction: 'OUTBOUND',
          body: preview,
          status: { in: ['PENDING', 'SENT', 'DELIVERED', 'READ'] },
          createdAt: { gte: new Date(Date.now() - 20_000) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (recent) return { outbound: this.presentMessage(recent), inbound: null, ai: null, duplicate: true };
      const lastInbound = await this.prisma.whatsAppMessage.findFirst({
        where: { conversationId, direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
      });
      if (!sessionWindowOpen(lastInbound?.createdAt ?? null, new Date())) {
        throw new AppException(
          'WHATSAPP_SESSION_CLOSED',
          'WhatsApp accepts a free-form message only within 24 hours of the customer last reply. Send an approved template instead.',
          409,
        );
      }
    }

    const reserved = await this.reserveOutbound(conversationId, preview, templateName ? 'template' : 'text', idempotencyKey);
    if ('duplicate' in reserved) return { outbound: this.presentMessage(reserved.message), inbound: null, ai: null, duplicate: true };
    try {
      const sent = templateName
        ? await this.whatsapp.sendTemplate({
            to: conversation.contactPhone,
            templateName,
            language: input.templateLanguage,
            variables: input.variables ?? {},
          })
        : await this.whatsapp.sendMessage({ to: conversation.contactPhone, body: text });
      const outbound = await this.prisma.whatsAppMessage.update({
        where: { id: reserved.id },
        data: {
          status: 'SENT',
          providerMessageId: sent.providerMessageId,
          statusEvents: [
            { status: 'PENDING', at: reserved.createdAt.toISOString(), source: 'crm' },
            { status: 'SENT', at: new Date().toISOString(), source: 'api' },
          ],
        },
      });
      await this.touchConversation(conversation.leadId, conversationId, actor.id, 'WhatsApp message accepted by Meta');
      this.events.publish({ type: 'message.created', conversationId, messageId: outbound.id, status: 'SENT' });
      return { outbound: this.presentMessage(outbound), inbound: null, ai: null, duplicate: false };
    } catch (error) {
      const apiError = error instanceof WhatsAppApiError
        ? error
        : new WhatsAppApiError('WHATSAPP_UNAVAILABLE', 'Meta could not be reached', 502);
      const failed = await this.prisma.whatsAppMessage.update({
        where: { id: reserved.id },
        data: {
          status: 'FAILED',
          errorCode: apiError.errorCode,
          statusEvents: [
            { status: 'PENDING', at: reserved.createdAt.toISOString(), source: 'crm' },
            { status: 'FAILED', at: new Date().toISOString(), source: 'api', errorCode: apiError.errorCode },
          ],
        },
      });
      this.events.publish({ type: 'message.status', conversationId, messageId: failed.id, status: 'FAILED' });
      const message = apiError.retryAfterSeconds
        ? `${apiError.message} Retry after ${apiError.retryAfterSeconds} seconds.`
        : apiError.message;
      throw new AppException(apiError.errorCode, message, whatsAppClientStatus(apiError.status));
    }
  }

  private async reserveOutbound(conversationId: string, body: string, messageType: string, idempotencyKey?: string) {
    try {
      return await this.prisma.whatsAppMessage.create({
        data: {
          conversationId,
          direction: 'OUTBOUND',
          body,
          status: 'PENDING',
          messageType,
          idempotencyKey,
          statusEvents: [{ status: 'PENDING', at: new Date().toISOString(), source: 'crm' }],
        },
      });
    } catch (error) {
      if (idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const message = await this.prisma.whatsAppMessage.findUnique({
          where: { conversationId_idempotencyKey: { conversationId, idempotencyKey } },
        });
        if (message) return { duplicate: true as const, message };
      }
      throw error;
    }
  }

  private async touchConversation(leadId: string, conversationId: string, userId: string, summary: string) {
    await this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
    await this.prisma.lead.update({ where: { id: leadId }, data: { lastContactAt: new Date() } });
    await this.prisma.leadActivity.create({
      data: { leadId, userId, type: 'WHATSAPP_SENT', summary },
    });
  }

  private async activeDocuments() {
    const docs = await this.prisma.knowledgeBaseDocument.findMany({
      where: { isActive: true, knowledgeBase: { isActive: true } },
      include: { knowledgeBase: true },
    });
    return docs.map((doc) => ({
      title: doc.title,
      content: doc.content,
      category: doc.knowledgeBase.category,
      isActive: true,
    }));
  }

  private presentConversation(conversation: {
    id: string;
    leadId: string;
    contactPhone: string;
    lastMessageAt: Date | null;
    messages: {
      id: string;
      direction: string;
      body: string;
      status: string;
      createdAt: Date;
    }[];
    lead?: { id: string; name: string; shopName: string | null };
  }) {
    return {
      id: conversation.id,
      leadId: conversation.leadId,
      lead: conversation.lead ?? null,
      contactPhone: conversation.contactPhone,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      messages: conversation.messages.map((message) => this.presentMessage(message)),
    };
  }

  private presentMessage(message: {
    id: string;
    direction: string;
    body: string;
    status: string;
    createdAt: Date;
    errorCode?: string | null;
  }) {
    return {
      id: message.id,
      direction: message.direction,
      body: message.body,
      status: message.status,
      errorCode: message.errorCode ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  }
}

function templatePreview(name: string, variables?: Record<string, string>) {
  const values = Object.values(variables ?? {}).filter((value) => typeof value === 'string' && value.trim());
  return values.length > 0 ? `[template] ${name}: ${values.join(', ')}` : `[template] ${name}`;
}
