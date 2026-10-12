import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { AuditService } from '../audit/audit.service';
import type { AIProvider } from '../integrations/ai/ai.provider';
import { describeAiIntegration } from '../integrations/ai/anthropic-config';
import { AI_PROVIDER } from '../integrations/tokens';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
  ) {}

  connectionReport() {
    return describeAiIntegration({
      provider: this.config.get<string>('AI_PROVIDER'),
      env: this.config,
      probe: this.ai.connectionState(),
    });
  }

  async testConnection(actor: Actor) {
    const before = this.connectionReport();
    if (before.provider !== 'anthropic') {
      throw new AppException('AI_PROVIDER_MOCK', 'An Anthropic connection test runs only when AI_PROVIDER=anthropic', 409);
    }
    if (before.configuration !== 'valid') {
      throw new AppException('PROVIDER_NOT_CONFIGURED', 'Anthropic configuration is incomplete', 409);
    }
    await this.ai.probeConnection();
    const report = this.connectionReport();
    await this.audit.record({
      userId: actor.id,
      action: 'AI_CONNECTION_TESTED',
      entity: 'AI',
      entityId: 'anthropic',
      after: {
        connection: report.connection,
        configuration: report.configuration,
        model: report.model,
      },
    });
    return report;
  }

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
