import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import type { AIProvider } from '../integrations/ai/ai.provider';
import { AI_PROVIDER } from '../integrations/tokens';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
  ) {}

  async reply(input: { leadId: string; message: string; channel?: string }, actor: Actor) {
    const lead = await this.prisma.lead.findFirst({ where: { id: input.leadId, deletedAt: null } });
    if (!lead) throw new AppException('LEAD_NOT_FOUND', 'Lead was not found', 404);
    const docs = await this.prisma.knowledgeBaseDocument.findMany({
      where: { isActive: true, knowledgeBase: { isActive: true } },
      include: { knowledgeBase: true },
    });
    const answer = await this.ai.generateResponse({
      message: input.message,
      documents: docs.map((doc) => ({
        title: doc.title,
        content: doc.content,
        category: doc.knowledgeBase.category,
      })),
    });
    const conversation = await this.prisma.aIConversation.create({
      data: {
        leadId: lead.id,
        channel: input.channel ?? 'CRM',
        messages: {
          create: [
            { role: 'USER', content: input.message },
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
      include: { messages: true },
    });
    await this.prisma.leadActivity.create({
      data: { leadId: lead.id, userId: actor.id, type: 'AI_RESPONSE', summary: 'AI response generated' },
    });
    if (answer.escalateToHuman) {
      const owner = lead.assignedUserId ?? actor.id;
      await this.prisma.followUp.create({
        data: {
          leadId: lead.id,
          userId: owner,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          notes: `AI escalated: ${input.message}`,
        },
      });
      await this.notifications.notifyUser(owner, {
        type: 'CUSTOMER_RESPONSE',
        title: 'AI needs a human follow-up',
        body: answer.text,
        entityType: 'Lead',
        entityId: lead.id,
      });
    }
    return { conversationId: conversation.id, ...answer };
  }

  async summarize(leadId: string) {
    const messages = await this.prisma.aIMessage.findMany({
      where: { conversation: { leadId } },
      orderBy: { createdAt: 'asc' },
      take: 30,
    });
    const summary = await this.ai.summarizeConversation(
      messages.map((message) => ({ role: message.role, content: message.content })),
    );
    return { summary };
  }
}
