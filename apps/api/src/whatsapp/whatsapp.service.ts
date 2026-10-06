import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { pageArgs } from '../common/page.dto';
import type { AIProvider } from '../integrations/ai/ai.provider';
import { AI_PROVIDER, WHATSAPP_PROVIDER } from '../integrations/tokens';
import type { DeliveryStatus, WhatsAppProvider } from '../integrations/whatsapp/whatsapp.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
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

  async sendMessage(conversationId: string, body: string, actor: Actor) {
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
    return {
      outbound: this.presentMessage(outbound),
      inbound: this.presentMessage(inbound),
      ai: { ...this.presentMessage(aiOutbound), confidence: answer.confidence, escalateToHuman: answer.escalateToHuman },
      aiConversationId: aiConversation.id,
    };
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

  private presentMessage(message: { id: string; direction: string; body: string; status: string; createdAt: Date }) {
    return {
      id: message.id,
      direction: message.direction,
      body: message.body,
      status: message.status,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
