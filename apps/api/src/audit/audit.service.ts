import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { pageArgs } from '../common/page.dto';
import { requestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
    ip?: string | null;
  }) {
    const store = requestContext.getStore();
    await this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? undefined,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? undefined,
        beforeData: input.before === undefined ? undefined : (input.before as Prisma.InputJsonValue),
        afterData: input.after === undefined ? undefined : (input.after as Prisma.InputJsonValue),
        ipAddress: input.ip ?? store?.ip,
        requestId: store?.requestId,
      },
    });
  }

  async list(query: { page?: number; pageSize?: number; action?: string; entity?: string; q?: string }) {
    const { page, pageSize, skip, take } = pageArgs(query);
    const where: Prisma.AuditLogWhereInput = {
      action: query.action || undefined,
      entity: query.entity || undefined,
      ...(query.q
        ? {
            OR: [
              { action: { contains: query.q, mode: 'insensitive' } },
              { entity: { contains: query.q, mode: 'insensitive' } },
              { entityId: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
    ]);
    return { items, page, pageSize, total };
  }
}
