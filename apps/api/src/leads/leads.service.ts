import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isValidEmail, normalizePhone } from '@aijewel/shared';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { pageArgs } from '../common/page.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { leadInclude, presentLead } from './lead.presenter';
import type { BulkLeadDto, CreateLeadDto, LeadQueryDto, UpdateLeadDto } from './leads.dto';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: LeadQueryDto) {
    const { page, pageSize, skip, take } = pageArgs(query);
    const where = await this.where(query);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortDir = query.sortDir ?? 'desc';
    const [total, items] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortDir },
        include: leadInclude,
      }),
    ]);
    return { items: items.map((lead) => presentLead(lead)), page, pageSize, total };
  }

  async get(id: string) {
    const lead = await this.findActive(id);
    return presentLead(lead);
  }

  async create(input: CreateLeadDto, actor: Actor) {
    const phone = this.requirePhone(input.phone);
    const whatsappNumber = input.whatsappNumber ? this.requirePhone(input.whatsappNumber) : phone;
    this.requireEmail(input.email);
    await this.assertPhoneAvailable(phone);
    const status = await this.statusByCode(input.status ?? 'NEW');
    const source = await this.sourceByCode(input.leadSource ?? 'MANUAL');
    if (input.assignedUserId) await this.assertUser(input.assignedUserId);
    const companyId = await this.companyFor(input.shopName, input.location);
    const lead = await this.prisma.lead.create({
      data: {
        name: input.name.trim(),
        phone,
        whatsappNumber,
        email: input.email?.trim().toLowerCase(),
        shopName: input.shopName?.trim(),
        location: input.location?.trim(),
        statusId: status.id,
        leadSourceId: source.id,
        assignedUserId: input.assignedUserId,
        companyId,
        customerCategory: input.customerCategory?.trim(),
        previousEnquiry: input.previousEnquiry?.trim(),
        nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined,
        activities: { create: { type: 'LEAD_CREATED', summary: 'Lead created', userId: actor.id } },
        notes: input.notes ? { create: { body: input.notes.trim(), userId: actor.id } } : undefined,
      },
      include: leadInclude,
    });
    if (input.tags?.length) await this.replaceTags(lead.id, input.tags);
    const fresh = await this.findActive(lead.id);
    await this.audit.record({
      userId: actor.id,
      action: 'LEAD_CREATED',
      entity: 'Lead',
      entityId: lead.id,
      after: presentLead(fresh),
    });
    if (fresh.assignedUserId) {
      await this.notifications.notifyUser(fresh.assignedUserId, {
        type: 'NEW_LEAD',
        title: 'New lead assigned',
        body: `${fresh.name} was added to your pipeline.`,
        entityType: 'Lead',
        entityId: fresh.id,
      });
    } else {
      await this.notifications.notifyRole('SALES', {
        type: 'NEW_LEAD',
        title: 'New lead',
        body: `${fresh.name} was created and is unassigned.`,
        entityType: 'Lead',
        entityId: fresh.id,
      });
    }
    return presentLead(fresh);
  }

  async update(id: string, input: UpdateLeadDto, actor: Actor) {
    const existing = await this.findActive(id);
    const phone = input.phone ? this.requirePhone(input.phone) : undefined;
    if (phone && phone !== existing.phone) await this.assertPhoneAvailable(phone, id);
    if (input.email !== undefined) this.requireEmail(input.email);
    const status = input.status ? await this.statusByCode(input.status) : undefined;
    const source = input.leadSource ? await this.sourceByCode(input.leadSource) : undefined;
    if (input.assignedUserId) await this.assertUser(input.assignedUserId);
    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        phone,
        whatsappNumber: input.whatsappNumber ? this.requirePhone(input.whatsappNumber) : undefined,
        email: input.email === undefined ? undefined : input.email.trim().toLowerCase(),
        shopName: input.shopName?.trim(),
        location: input.location?.trim(),
        statusId: status?.id,
        leadSourceId: source?.id,
        assignedUserId: input.assignedUserId,
        customerCategory: input.customerCategory?.trim(),
        previousEnquiry: input.previousEnquiry?.trim(),
        nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined,
        lastContactAt: input.lastContactAt ? new Date(input.lastContactAt) : undefined,
      },
      include: leadInclude,
    });
    if (input.tags) await this.replaceTags(id, input.tags);
    const fresh = await this.findActive(id);
    await this.prisma.leadActivity.create({
      data: {
        leadId: id,
        userId: actor.id,
        type: status ? 'STATUS_CHANGED' : 'LEAD_UPDATED',
        summary: status ? `Status changed to ${status.name}` : 'Lead updated',
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'LEAD_UPDATED',
      entity: 'Lead',
      entityId: id,
      before: presentLead(existing),
      after: presentLead(fresh),
    });
    return presentLead(fresh.tags ? fresh : updated);
  }

  async remove(id: string, actor: Actor) {
    const existing = await this.findActive(id);
    await this.prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.prisma.leadActivity.create({
      data: { leadId: id, userId: actor.id, type: 'LEAD_DELETED', summary: 'Lead deleted' },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'LEAD_DELETED',
      entity: 'Lead',
      entityId: id,
      before: presentLead(existing),
    });
    return { id, deleted: true };
  }

  async addNote(id: string, body: string, actor: Actor) {
    await this.findActive(id);
    const note = await this.prisma.leadNote.create({
      data: { leadId: id, userId: actor.id, body: body.trim() },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    await this.prisma.leadActivity.create({
      data: { leadId: id, userId: actor.id, type: 'NOTE_ADDED', summary: 'Note added' },
    });
    return {
      id: note.id,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      author: `${note.user.firstName} ${note.user.lastName}`,
    };
  }

  async addFollowUp(id: string, input: { dueAt: string; notes?: string; userId?: string }, actor: Actor) {
    await this.findActive(id);
    const userId = input.userId ?? actor.id;
    await this.assertUser(userId);
    const dueAt = new Date(input.dueAt);
    if (Number.isNaN(dueAt.getTime())) throw new AppException('VALIDATION_ERROR', 'Follow-up date is invalid', 400);
    const followUp = await this.prisma.followUp.create({
      data: { leadId: id, userId, dueAt, notes: input.notes?.trim() },
    });
    await this.prisma.lead.update({ where: { id }, data: { nextFollowUpAt: dueAt } });
    await this.prisma.leadActivity.create({
      data: { leadId: id, userId: actor.id, type: 'FOLLOW_UP_CREATED', summary: 'Follow-up created' },
    });
    await this.notifications.notifyUser(userId, {
      type: 'FOLLOW_UP_DUE',
      title: 'Follow-up scheduled',
      body: input.notes?.trim() || 'A follow-up was added to a lead.',
      entityType: 'FollowUp',
      entityId: followUp.id,
    });
    return followUp;
  }

  async convert(id: string, actor: Actor) {
    const lead = await this.findActive(id);
    if (lead.customer) return { customerId: lead.customer.id, alreadyConverted: true };
    const status = await this.statusByCode('CONVERTED');
    const customer = await this.prisma.customer.create({
      data: {
        leadId: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        shopName: lead.shopName,
        location: lead.location,
        category: lead.customerCategory,
        companyId: lead.companyId,
      },
    });
    await this.prisma.lead.update({ where: { id }, data: { statusId: status.id } });
    await this.prisma.leadActivity.create({
      data: { leadId: id, userId: actor.id, type: 'LEAD_CONVERTED', summary: 'Lead converted to customer' },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'LEAD_CONVERTED',
      entity: 'Customer',
      entityId: customer.id,
      after: { leadId: id },
    });
    return { customerId: customer.id, alreadyConverted: false };
  }

  async merge(primaryId: string, duplicateId: string, actor: Actor) {
    if (primaryId === duplicateId) throw new AppException('VALIDATION_ERROR', 'Choose two different leads', 400);
    const primary = await this.findActive(primaryId);
    const duplicate = await this.findActive(duplicateId);
    await this.prisma.$transaction(async (tx) => {
      await tx.leadNote.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
      await tx.leadActivity.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
      await tx.followUp.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
      await tx.call.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
      await tx.meeting.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
      await tx.whatsAppConversation.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
      await tx.campaignMessage.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
      await tx.aIConversation.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
      await tx.contact.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
      await tx.whatsAppGroupMember.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
      if (!primary.customer && duplicate.customer) {
        await tx.customer.update({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
      }
      await tx.lead.update({ where: { id: duplicateId }, data: { deletedAt: new Date() } });
      await tx.leadActivity.create({
        data: {
          leadId: primaryId,
          userId: actor.id,
          type: 'LEAD_MERGED',
          summary: `Merged duplicate lead ${duplicate.displayId}`,
        },
      });
    });
    await this.audit.record({
      userId: actor.id,
      action: 'LEAD_MERGED',
      entity: 'Lead',
      entityId: primaryId,
      before: { duplicateId, duplicateDisplayId: duplicate.displayId },
      after: { primaryId },
    });
    return { primaryId, duplicateId, merged: true };
  }

  async bulk(input: BulkLeadDto, actor: Actor) {
    if (input.ids.length === 0) throw new AppException('VALIDATION_ERROR', 'Select at least one lead', 400);
    const leads = await this.prisma.lead.findMany({
      where: { id: { in: input.ids }, deletedAt: null },
      select: { id: true },
    });
    const ids = leads.map((lead) => lead.id);
    if (input.action === 'delete') {
      await this.prisma.lead.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
      await this.audit.record({ userId: actor.id, action: 'LEAD_DELETED', entity: 'Lead', after: { ids } });
      return { updated: ids.length };
    }
    if (input.action === 'assign') {
      if (!input.assignedUserId) throw new AppException('VALIDATION_ERROR', 'assignedUserId is required', 400);
      await this.assertUser(input.assignedUserId);
      await this.prisma.lead.updateMany({ where: { id: { in: ids } }, data: { assignedUserId: input.assignedUserId } });
      await this.notifications.notifyUser(input.assignedUserId, {
        type: 'NEW_LEAD',
        title: 'Leads assigned',
        body: `${ids.length} leads were assigned to you.`,
        entityType: 'Lead',
      });
      return { updated: ids.length };
    }
    if (input.action === 'status') {
      if (!input.status) throw new AppException('VALIDATION_ERROR', 'status is required', 400);
      const status = await this.statusByCode(input.status);
      await this.prisma.lead.updateMany({ where: { id: { in: ids } }, data: { statusId: status.id } });
      return { updated: ids.length };
    }
    if (input.action === 'tag') {
      if (!input.tag?.trim()) throw new AppException('VALIDATION_ERROR', 'tag is required', 400);
      const tag = await this.prisma.leadTag.upsert({
        where: { name: input.tag.trim() },
        update: {},
        create: { name: input.tag.trim() },
      });
      await this.prisma.leadTagOnLead.createMany({
        data: ids.map((leadId) => ({ leadId, tagId: tag.id })),
        skipDuplicates: true,
      });
      return { updated: ids.length, tag: tag.name };
    }
    if (input.action === 'followup') {
      if (!input.dueAt) throw new AppException('VALIDATION_ERROR', 'dueAt is required', 400);
      await this.prisma.followUp.createMany({
        data: ids.map((leadId) => ({
          leadId,
          userId: actor.id,
          dueAt: new Date(input.dueAt!),
          notes: input.notes,
        })),
      });
      await this.prisma.lead.updateMany({ where: { id: { in: ids } }, data: { nextFollowUpAt: new Date(input.dueAt) } });
      return { updated: ids.length };
    }
    const campaign = await this.prisma.campaign.create({
      data: {
        name: input.campaignName?.trim() || `Lead selection ${new Date().toISOString().slice(0, 10)}`,
        kind: 'PERSONALIZED',
        platform: 'WHATSAPP',
        objective: 'OUTCOME_LEADS',
        content:
          input.template?.trim() ||
          'Hi {{customer_name}}, we have a new AIJewel solution that may be useful for {{shop_name}} in {{location}}.',
        status: 'DRAFT',
        leadIds: ids,
        createdById: actor.id,
        budget: 0,
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'CAMPAIGN_CREATED',
      entity: 'Campaign',
      entityId: campaign.id,
      after: { leadCount: ids.length },
    });
    return { updated: ids.length, campaignId: campaign.id };
  }

  async exportCsv(query: LeadQueryDto) {
    const where = await this.where({ ...query, page: 1, pageSize: 100 });
    const header = ['displayId', 'name', 'phone', 'email', 'shopName', 'location', 'status', 'source', 'category'];
    const lines = [header.join(',')];
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.prisma.lead.findMany({
        where,
        take: 500,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        include: { status: true, leadSource: true },
      });
      if (batch.length === 0) break;
      for (const lead of batch) {
        lines.push(
          [lead.displayId, lead.name, lead.phone, lead.email, lead.shopName, lead.location, lead.status.code, lead.leadSource.code, lead.customerCategory]
            .map((value) => csvCell(value))
            .join(','),
        );
      }
      cursor = batch[batch.length - 1].id;
      if (batch.length < 500) break;
    }
    return lines.join('\n');
  }

  async notifyDueFollowUps() {
    const due = await this.prisma.followUp.findMany({
      where: { status: 'OPEN', dueAt: { lte: new Date() } },
      include: { lead: { select: { name: true } } },
      take: 100,
    });
    for (const followUp of due) {
      const existing = await this.prisma.notification.findFirst({
        where: { entityType: 'FollowUp', entityId: followUp.id, type: 'FOLLOW_UP_DUE' },
      });
      if (existing) continue;
      await this.notifications.notifyUser(followUp.userId, {
        type: 'FOLLOW_UP_DUE',
        title: 'Follow-up due',
        body: `Follow up with ${followUp.lead.name}.`,
        entityType: 'FollowUp',
        entityId: followUp.id,
      });
    }
  }

  private async where(query: LeadQueryDto): Promise<Prisma.LeadWhereInput> {
    const q = query.q?.trim();
    const displayId = displayIdFromQuery(q);
    return {
      deletedAt: null,
      status: query.status ? { code: query.status } : undefined,
      leadSource: query.source ? { code: query.source } : undefined,
      location: query.location ? { contains: query.location, mode: 'insensitive' } : undefined,
      assignedUserId: query.assignedUserId || undefined,
      customerCategory: query.category || undefined,
      tags: query.tag ? { some: { tag: { name: { equals: query.tag, mode: 'insensitive' } } } } : undefined,
      campaignMessages: query.campaignId ? { some: { campaignId: query.campaignId } } : undefined,
      createdAt:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
              lte: query.dateTo ? new Date(query.dateTo) : undefined,
            }
          : undefined,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q.replace(/\s+/g, '') } },
              { email: { contains: q, mode: 'insensitive' } },
              { shopName: { contains: q, mode: 'insensitive' } },
              { location: { contains: q, mode: 'insensitive' } },
              ...(displayId ? [{ displayId }] : []),
            ],
          }
        : {}),
    };
  }

  private async findActive(id: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id, deletedAt: null }, include: leadInclude });
    if (!lead) throw new AppException('LEAD_NOT_FOUND', 'Lead was not found', 404);
    return lead;
  }

  private requirePhone(value: string) {
    const phone = normalizePhone(value);
    if (!phone) throw new AppException('VALIDATION_ERROR', 'Phone number is invalid', 400);
    return phone;
  }

  private requireEmail(email?: string) {
    if (!isValidEmail(email)) throw new AppException('VALIDATION_ERROR', 'Email is invalid', 400);
  }

  private async assertPhoneAvailable(phone: string, ignoreId?: string) {
    const existing = await this.prisma.lead.findFirst({
      where: { phone, deletedAt: null, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new AppException('DUPLICATE_LEAD', 'A lead with this phone number already exists', 409);
  }

  private async statusByCode(code: string) {
    const status = await this.prisma.leadStatusDefinition.findUnique({ where: { code } });
    if (!status || !status.isActive) throw new AppException('VALIDATION_ERROR', 'Lead status is invalid', 400);
    return status;
  }

  private async sourceByCode(code: string) {
    const source = await this.prisma.leadSource.findUnique({ where: { code } });
    if (!source) throw new AppException('VALIDATION_ERROR', 'Lead source is invalid', 400);
    return source;
  }

  private async assertUser(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, isActive: true }, select: { id: true } });
    if (!user) throw new AppException('USER_NOT_FOUND', 'Assigned user was not found', 404);
  }

  private async companyFor(shopName?: string, location?: string) {
    const name = shopName?.trim();
    if (!name) return undefined;
    const existing = await this.prisma.company.findFirst({ where: { name, location: location?.trim() } });
    if (existing) return existing.id;
    const created = await this.prisma.company.create({ data: { name, location: location?.trim() } });
    return created.id;
  }

  private async replaceTags(leadId: string, tags: string[]) {
    await this.prisma.leadTagOnLead.deleteMany({ where: { leadId } });
    for (const name of tags.map((tag) => tag.trim()).filter(Boolean)) {
      const tag = await this.prisma.leadTag.upsert({ where: { name }, update: {}, create: { name } });
      await this.prisma.leadTagOnLead.create({ data: { leadId, tagId: tag.id } });
    }
  }
}

function displayIdFromQuery(q: string | undefined): number | undefined {
  if (!q || !/^\d+$/.test(q)) return undefined;
  const value = Number(q);
  if (!Number.isSafeInteger(value) || value < 1 || value > 2147483647) return undefined;
  return value;
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
