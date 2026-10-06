import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertCampaignTransition,
  isValidDateRange,
  leadPersonalization,
  renderTemplate,
  type CampaignKind,
} from '@aijewel/shared';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { money, todayDate } from '../common/money';
import { pageArgs } from '../common/page.dto';
import type { MetaProvider } from '../integrations/meta/meta.provider';
import { META_PROVIDER } from '../integrations/tokens';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(META_PROVIDER) private readonly meta: MetaProvider,
  ) {}

  async list(query: { page?: number; pageSize?: number; q?: string; status?: string; kind?: string }) {
    const { page, pageSize, skip, take } = pageArgs(query);
    const where: Prisma.CampaignWhereInput = {
      status: query.status ? (query.status as Prisma.CampaignWhereInput['status']) : undefined,
      kind: query.kind ? (query.kind as Prisma.CampaignWhereInput['kind']) : undefined,
      name: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    ]);
    return { items: items.map((item) => this.present(item)), page, pageSize, total };
  }

  async get(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { messages: { take: 20, orderBy: { createdAt: 'desc' } }, metrics: true },
    });
    if (!campaign) throw new AppException('CAMPAIGN_NOT_FOUND', 'Campaign was not found', 404);
    return {
      ...this.present(campaign),
      messages: campaign.messages,
      metrics: campaign.metrics.map((metric) => ({ ...metric, spend: money(metric.spend), date: metric.date })),
    };
  }

  async create(
    input: {
      name: string;
      kind: CampaignKind;
      platform: string;
      objective: string;
      audience?: string;
      budget?: number;
      startDate?: string;
      endDate?: string;
      content: string;
      creative?: string;
      leadIds?: string[];
    },
    actor: Actor,
  ) {
    if (!isValidDateRange(input.startDate, input.endDate)) {
      throw new AppException('VALIDATION_ERROR', 'Campaign end date must be on or after the start date', 400);
    }
    if ((input.budget ?? 0) < 0) throw new AppException('VALIDATION_ERROR', 'Budget cannot be negative', 400);
    const external = input.kind === 'PERSONALIZED' ? null : await this.meta.createCampaign({
      name: input.name,
      objective: input.objective,
      budget: input.budget ?? 0,
    });
    const campaign = await this.prisma.campaign.create({
      data: {
        name: input.name.trim(),
        kind: input.kind,
        platform: input.platform,
        objective: input.objective,
        audience: input.audience,
        budget: input.budget ?? 0,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        content: input.content,
        creative: external ? `${input.creative ?? ''} ${external.externalId}`.trim() : input.creative,
        leadIds: input.leadIds ?? [],
        createdById: actor.id,
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'CAMPAIGN_CREATED',
      entity: 'Campaign',
      entityId: campaign.id,
      after: this.present(campaign),
    });
    return this.present(campaign);
  }

  async update(id: string, input: Record<string, unknown>, actor: Actor) {
    const existing = await this.mustGet(id);
    if (existing.status !== 'DRAFT' && existing.status !== 'REVIEW' && existing.status !== 'APPROVAL') {
      throw new AppException('INVALID_TRANSITION', 'Only draft campaigns can be edited', 400);
    }
    const startDate = typeof input.startDate === 'string' ? input.startDate : undefined;
    const endDate = typeof input.endDate === 'string' ? input.endDate : undefined;
    if (!isValidDateRange(startDate ?? existing.startDate?.toISOString(), endDate ?? existing.endDate?.toISOString())) {
      throw new AppException('VALIDATION_ERROR', 'Campaign end date must be on or after the start date', 400);
    }
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        name: typeof input.name === 'string' ? input.name : undefined,
        platform: typeof input.platform === 'string' ? input.platform : undefined,
        objective: typeof input.objective === 'string' ? input.objective : undefined,
        audience: typeof input.audience === 'string' ? input.audience : undefined,
        content: typeof input.content === 'string' ? input.content : undefined,
        creative: typeof input.creative === 'string' ? input.creative : undefined,
        budget: typeof input.budget === 'number' ? input.budget : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        leadIds: Array.isArray(input.leadIds) ? (input.leadIds as string[]) : undefined,
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'CAMPAIGN_UPDATED',
      entity: 'Campaign',
      entityId: campaign.id,
      before: this.present(existing),
      after: this.present(campaign),
    });
    return this.present(campaign);
  }

  async preview(id: string, leadIds?: string[]) {
    const campaign = await this.mustGet(id);
    const ids = (leadIds && leadIds.length > 0 ? leadIds : this.leadIds(campaign.leadIds)).slice(0, 50);
    if (ids.length === 0) throw new AppException('VALIDATION_ERROR', 'Choose at least one customer to preview', 400);
    const leads = await this.prisma.lead.findMany({ where: { id: { in: ids }, deletedAt: null } });
    return leads.map((lead) => {
      const rendered = renderTemplate(campaign.content, leadPersonalization(lead));
      return {
        leadId: lead.id,
        customer: lead.name,
        shop: lead.shopName,
        location: lead.location,
        message: rendered.text,
        missing: rendered.missing,
      };
    });
  }

  async transition(id: string, to: string, actor: Actor) {
    const campaign = await this.mustGet(id);
    try {
      assertCampaignTransition(campaign.kind, campaign.status, to);
    } catch (error) {
      throw new AppException('INVALID_TRANSITION', error instanceof Error ? error.message : 'Invalid transition', 400);
    }
    if ((to === 'SCHEDULED' || to === 'APPROVED') && campaign.kind !== 'PERSONALIZED') {
      await this.meta.scheduleCampaign(campaign.id);
    }
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        status: to as Prisma.CampaignUpdateInput['status'],
        startDate: to === 'SCHEDULED' && !campaign.startDate ? new Date() : undefined,
      },
    });
    const action = to === 'APPROVED' || to === 'SCHEDULED' ? 'CAMPAIGN_APPROVED' : 'CAMPAIGN_UPDATED';
    await this.audit.record({
      userId: actor.id,
      action,
      entity: 'Campaign',
      entityId: id,
      before: { status: campaign.status },
      after: { status: to },
    });
    return this.present(updated);
  }

  async execute(id: string, actor: Actor) {
    const campaign = await this.mustGet(id);
    if (campaign.status !== 'SCHEDULED') {
      throw new AppException('INVALID_TRANSITION', 'Schedule the campaign before it can run', 400);
    }
    const locked = await this.prisma.campaign.updateMany({
      where: { id, status: 'SCHEDULED' },
      data: { status: campaign.kind === 'PERSONALIZED' ? 'SENT' : 'RUNNING' },
    });
    if (locked.count === 0) throw new AppException('INVALID_TRANSITION', 'Campaign is already running', 409);
    try {
      return await this.finishExecution(id, campaign, actor);
    } catch (error) {
      await this.prisma.campaign.update({ where: { id }, data: { status: 'FAILED' } });
      await this.notifications.notifyUser(campaign.createdById, {
        type: 'CAMPAIGN_FAILED',
        title: 'Campaign failed',
        body: `${campaign.name} stopped before it could finish.`,
        entityType: 'Campaign',
        entityId: id,
      });
      throw error;
    }
  }

  private async finishExecution(
    id: string,
    campaign: { kind: string; leadIds: Prisma.JsonValue | null; content: string; creative: string | null; name: string; createdById: string },
    actor: Actor,
  ) {
    const ids = this.leadIds(campaign.leadIds);
    const leads = await this.prisma.lead.findMany({ where: { id: { in: ids }, deletedAt: null } });
    if (leads.length > 0) {
      await this.prisma.campaignMessage.createMany({
        data: leads.map((lead) => ({
          campaignId: id,
          leadId: lead.id,
          renderedBody: renderTemplate(campaign.content, leadPersonalization(lead)).text,
          status: 'SENT',
          sentAt: new Date(),
        })),
      });
      await this.prisma.leadActivity.createMany({
        data: leads.map((lead) => ({
          leadId: lead.id,
          userId: actor.id,
          type: 'CAMPAIGN_SENT',
          summary: `Campaign sent: ${campaign.name}`,
        })),
      });
    }
    const performance = await this.meta.getPerformance(campaign.creative || id, leads.length);
    await this.prisma.campaignMetric.upsert({
      where: { campaignId_date: { campaignId: id, date: todayDate() } },
      update: performance,
      create: { campaignId: id, date: todayDate(), ...performance },
    });
    const finalStatus = campaign.kind === 'PERSONALIZED' ? 'REPORT' : 'COMPLETED';
    const updated = await this.prisma.campaign.update({ where: { id }, data: { status: finalStatus } });
    await this.audit.record({
      userId: actor.id,
      action: 'CAMPAIGN_SENT',
      entity: 'Campaign',
      entityId: id,
      after: { messages: leads.length, status: finalStatus },
    });
    await this.notifications.notifyUser(campaign.createdById, {
      type: 'CAMPAIGN_COMPLETED',
      title: 'Campaign completed',
      body: `${campaign.name} finished in mock mode with ${leads.length} messages.`,
      entityType: 'Campaign',
      entityId: id,
    });
    return this.present(updated);
  }

  async executeDue() {
    const due = await this.prisma.campaign.findMany({
      where: {
        status: 'SCHEDULED',
        OR: [{ startDate: null }, { startDate: { lte: new Date() } }],
      },
    });
    for (const campaign of due) {
      const creator = await this.prisma.user.findUnique({
        where: { id: campaign.createdById },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      if (!creator) continue;
      try {
        await this.execute(campaign.id, {
          id: creator.id,
          email: creator.email,
          firstName: creator.firstName,
          lastName: creator.lastName,
          role: creator.role.name,
          permissions: creator.role.permissions.map((item) => item.permission.code),
        });
      } catch {
        await this.notifications.notifyRole('ADMIN', {
          type: 'INTEGRATION_FAILURE',
          title: 'Campaign execution failed',
          body: `${campaign.name} could not be executed.`,
          entityType: 'Campaign',
          entityId: campaign.id,
        });
      }
    }
  }

  async templates() {
    return this.prisma.template.findMany({ orderBy: { name: 'asc' } });
  }

  async createTemplate(input: { name: string; channel: string; body: string }) {
    return this.prisma.template.create({ data: input });
  }

  async segments() {
    return this.prisma.segment.findMany({ orderBy: { name: 'asc' } });
  }

  async createSegment(input: { name: string; filterJson: Prisma.InputJsonValue }) {
    return this.prisma.segment.create({ data: input });
  }

  private async mustGet(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new AppException('CAMPAIGN_NOT_FOUND', 'Campaign was not found', 404);
    return campaign;
  }

  private leadIds(value: Prisma.JsonValue | null) {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private present(campaign: {
    id: string;
    name: string;
    kind: string;
    platform: string;
    objective: string;
    audience: string | null;
    budget: Prisma.Decimal;
    startDate: Date | null;
    endDate: Date | null;
    content: string;
    creative: string | null;
    status: string;
    leadIds: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: campaign.id,
      name: campaign.name,
      kind: campaign.kind,
      platform: campaign.platform,
      objective: campaign.objective,
      audience: campaign.audience,
      budget: money(campaign.budget),
      startDate: campaign.startDate?.toISOString() ?? null,
      endDate: campaign.endDate?.toISOString() ?? null,
      content: campaign.content,
      creative: campaign.creative,
      status: campaign.status,
      leadIds: this.leadIds(campaign.leadIds),
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }
}
