import { readFile } from 'fs/promises';
import { Injectable } from '@nestjs/common';
import { classifyImportRows, isValidEmail, mapCsvRows, normalizePhone, parseCsv } from '@aijewel/shared';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { fromRepo } from '../common/paths';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

interface PreparedLead {
  rowNumber: number;
  phone: string | null;
  valid: boolean;
  name: string;
  email?: string;
  whatsappNumber?: string;
  shopName?: string;
  location?: string;
  statusId?: string;
  sourceId?: string;
  notes?: string;
  tags: string[];
  customerCategory?: string;
  previousEnquiry?: string;
  assignedUserId?: string;
  groupId?: string;
  groupName?: string;
}

@Injectable()
export class LeadImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async list(query: { page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.importJob.count({ where }),
      this.prisma.importJob.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);
    return { items, page, pageSize, total };
  }

  async importCsv(file: { buffer: Buffer; originalname: string } | undefined, mappingRaw: string | undefined, actor: Actor) {
    if (!file) throw new AppException('VALIDATION_ERROR', 'CSV file is required', 400);
    let mapping: Record<string, string> | undefined;
    if (mappingRaw) {
      try {
        mapping = JSON.parse(mappingRaw) as Record<string, string>;
      } catch {
        throw new AppException('VALIDATION_ERROR', 'Column mapping must be valid JSON', 400);
      }
    }
    const table = parseCsv(file.buffer.toString('utf8'));
    const { records } = mapCsvRows(table, mapping);
    const prepared = await this.prepareRecords(
      records.map((record, index) => ({ record, rowNumber: index + 2 })),
      'CSV_IMPORT',
    );
    const summary = await this.persist(prepared, actor, 'CSV', file.originalname || 'upload.csv');
    return summary;
  }

  async importWhatsAppGroup(actor: Actor, file?: { buffer: Buffer; originalname: string }) {
    const raw = file
      ? file.buffer.toString('utf8')
      : await readFile(fromRepo(this.config.get('WHATSAPP_GROUP_FIXTURE') ?? './mocks/whatsapp/aijewel-hyderabad-group.json'), 'utf8');
    let parsed: { groupId?: string; groupName?: string; members?: { name?: string; phone?: string; shopName?: string; location?: string }[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AppException('VALIDATION_ERROR', 'WhatsApp group file must be JSON', 400);
    }
    if (!parsed.groupId || !parsed.groupName || !Array.isArray(parsed.members)) {
      throw new AppException('VALIDATION_ERROR', 'Group file needs groupId, groupName, and members', 400);
    }
    const group = await this.prisma.whatsAppGroup.upsert({
      where: { externalId: parsed.groupId },
      update: { name: parsed.groupName },
      create: { externalId: parsed.groupId, name: parsed.groupName },
    });
    const records = parsed.members.map((member, index) => ({
      rowNumber: index + 1,
      record: {
        name: member.name ?? '',
        phone: member.phone ?? '',
        whatsappNumber: member.phone ?? '',
        shopName: member.shopName ?? '',
        location: member.location ?? '',
        leadSource: 'WHATSAPP_GROUP',
        status: 'NEW',
        customerCategory: 'RETAILER',
        email: '',
        tags: '',
        notes: '',
        previousEnquiry: '',
        assignedEmail: '',
      },
    }));
    const prepared = await this.prepareRecords(records, 'WHATSAPP_GROUP', {
      groupId: parsed.groupId,
      groupName: parsed.groupName,
    });
    const summary = await this.persist(prepared, actor, 'WHATSAPP_GROUP', file?.originalname || parsed.groupName, async (created) => {
      for (const lead of created) {
        await this.prisma.whatsAppGroupMember.upsert({
          where: { groupId_phone: { groupId: group.id, phone: lead.phone } },
          update: { name: lead.name, leadId: lead.id },
          create: { groupId: group.id, phone: lead.phone, name: lead.name, leadId: lead.id },
        });
        await this.prisma.whatsAppContact.upsert({
          where: { phone: lead.phone },
          update: { name: lead.name, leadId: lead.id },
          create: { phone: lead.phone, name: lead.name, waId: lead.phone, leadId: lead.id },
        });
      }
      const duplicates = prepared.filter((row) => !row.valid || !created.some((lead) => lead.phone === row.phone));
      for (const row of duplicates) {
        if (!row.phone) continue;
        const existing = await this.prisma.lead.findFirst({ where: { phone: row.phone, deletedAt: null }, select: { id: true } });
        if (!existing) continue;
        await this.prisma.whatsAppGroupMember.upsert({
          where: { groupId_phone: { groupId: group.id, phone: row.phone } },
          update: { leadId: existing.id, name: row.name },
          create: { groupId: group.id, phone: row.phone, name: row.name, leadId: existing.id },
        });
      }
      await this.prisma.whatsAppGroup.update({ where: { id: group.id }, data: { importedAt: new Date() } });
    });
    return summary;
  }

  private async prepareRecords(
    rows: { rowNumber: number; record: Record<string, string> }[],
    defaultSource: string,
    group?: { groupId: string; groupName: string },
  ): Promise<PreparedLead[]> {
    const [statuses, sources, users] = await Promise.all([
      this.prisma.leadStatusDefinition.findMany(),
      this.prisma.leadSource.findMany(),
      this.prisma.user.findMany({ select: { id: true, email: true } }),
    ]);
    const statusByCode = new Map(statuses.map((status) => [status.code, status.id]));
    const sourceByCode = new Map(sources.map((source) => [source.code, source.id]));
    const userByEmail = new Map(users.map((user) => [user.email, user.id]));
    return rows.map(({ rowNumber, record }) => {
      const phone = normalizePhone(record.phone);
      const email = record.email?.trim() || undefined;
      const statusCode = record.status?.trim() || 'NEW';
      const sourceCode = record.leadSource?.trim() || defaultSource;
      const assignedEmail = record.assignedEmail?.trim().toLowerCase();
      const statusId = statusByCode.get(statusCode);
      const sourceId = sourceByCode.get(sourceCode);
      const assignedUserId = assignedEmail ? userByEmail.get(assignedEmail) : undefined;
      const valid = Boolean(
        record.name?.trim() &&
          phone &&
          isValidEmail(email) &&
          statusId &&
          sourceId &&
          (!assignedEmail || assignedUserId),
      );
      return {
        rowNumber,
        phone,
        valid,
        name: record.name?.trim() ?? '',
        email,
        whatsappNumber: normalizePhone(record.whatsappNumber) ?? phone ?? undefined,
        shopName: record.shopName?.trim() || undefined,
        location: record.location?.trim() || undefined,
        statusId,
        sourceId,
        notes: record.notes?.trim() || undefined,
        tags: (record.tags ?? '').split(/[|,]/).map((tag) => tag.trim()).filter(Boolean),
        customerCategory: record.customerCategory?.trim() || undefined,
        previousEnquiry: record.previousEnquiry?.trim() || undefined,
        assignedUserId,
        groupId: group?.groupId,
        groupName: group?.groupName,
      };
    });
  }

  private async persist(
    prepared: PreparedLead[],
    actor: Actor,
    type: 'CSV' | 'WHATSAPP_GROUP',
    fileName: string,
    afterCreate?: (created: { id: string; phone: string; name: string }[]) => Promise<void>,
  ) {
    const existing = new Set<string>();
    const phones = prepared.map((row) => row.phone).filter((phone): phone is string => Boolean(phone));
    for (let index = 0; index < phones.length; index += 200) {
      const slice = phones.slice(index, index + 200);
      const found = await this.prisma.lead.findMany({
        where: { phone: { in: slice }, deletedAt: null },
        select: { phone: true },
      });
      found.forEach((lead) => existing.add(lead.phone));
    }
    const classified = classifyImportRows(
      prepared.map((row) => ({ rowNumber: row.rowNumber, phone: row.phone, valid: row.valid })),
      existing,
    );
    const byRow = new Map(prepared.map((row) => [row.rowNumber, row]));
    const created: { id: string; phone: string; name: string }[] = [];
    for (let index = 0; index < classified.validNew.length; index += 100) {
      const batch = classified.validNew.slice(index, index + 100);
      const rows = batch.map((item) => byRow.get(item.rowNumber)!);
      const leads = await this.prisma.lead.createManyAndReturn({
        data: rows.map((row) => ({
          name: row.name,
          phone: row.phone!,
          whatsappNumber: row.whatsappNumber,
          email: row.email,
          shopName: row.shopName,
          location: row.location,
          statusId: row.statusId!,
          leadSourceId: row.sourceId!,
          assignedUserId: row.assignedUserId,
          customerCategory: row.customerCategory,
          previousEnquiry: row.previousEnquiry,
          whatsappGroupId: row.groupId,
          whatsappGroupName: row.groupName,
        })),
        select: { id: true, phone: true, name: true },
      });
      created.push(...leads);
      await this.prisma.leadActivity.createMany({
        data: leads.map((lead) => ({
          leadId: lead.id,
          userId: actor.id,
          type: 'LEAD_IMPORTED',
          summary: type === 'WHATSAPP_GROUP' ? 'Imported from WhatsApp group' : 'Imported from CSV',
        })),
      });
      for (const row of rows) {
        const lead = leads.find((item) => item.phone === row.phone);
        if (!lead) continue;
        if (row.notes) {
          await this.prisma.leadNote.create({ data: { leadId: lead.id, userId: actor.id, body: row.notes } });
        }
        for (const tagName of row.tags) {
          const tag = await this.prisma.leadTag.upsert({ where: { name: tagName }, update: {}, create: { name: tagName } });
          await this.prisma.leadTagOnLead.create({ data: { leadId: lead.id, tagId: tag.id } });
        }
      }
    }
    if (afterCreate) await afterCreate(created);
    const invalidRows = classified.invalid.map((row) => ({
      row: row.rowNumber,
      message: 'Row is missing a valid name, phone, email, status, or source',
    }));
    const job = await this.prisma.importJob.create({
      data: {
        type,
        fileName,
        status: 'COMPLETED',
        totalRows: classified.summary.total,
        successful: classified.summary.successful,
        duplicates: classified.summary.duplicates,
        invalid: classified.summary.invalid,
        errors: {
          invalid: invalidRows.slice(0, 100),
          duplicateRows: classified.duplicates.slice(0, 100).map((row) => row.rowNumber),
        },
        createdById: actor.id,
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'LEAD_IMPORT',
      entity: 'ImportJob',
      entityId: job.id,
      after: classified.summary,
    });
    await this.notifications.notifyRole('ADMIN', {
      type: 'LEAD_IMPORT',
      title: 'Lead import finished',
      body: `${classified.summary.successful} leads imported, ${classified.summary.duplicates} duplicates, ${classified.summary.invalid} invalid.`,
      entityType: 'ImportJob',
      entityId: job.id,
    });
    return { ...classified.summary, importId: job.id, errors: invalidRows.slice(0, 100) };
  }
}
