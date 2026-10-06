import { Injectable } from '@nestjs/common';
import type { RoleName } from '@aijewel/shared';
import { pageArgs } from '../common/page.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyUser(
    userId: string,
    input: { type: string; title: string; body: string; entityType?: string; entityId?: string },
  ) {
    return this.prisma.notification.create({ data: { userId, ...input } });
  }

  async notifyRole(
    role: RoleName,
    input: { type: string; title: string; body: string; entityType?: string; entityId?: string },
  ) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, role: { name: role } },
      select: { id: true },
    });
    if (users.length === 0) return [];
    await this.prisma.notification.createMany({
      data: users.map((user) => ({ userId: user.id, ...input })),
    });
    return users;
  }

  async list(userId: string, query: { page?: number; pageSize?: number }) {
    const { page, pageSize, skip, take } = pageArgs(query);
    const where = { userId };
    const [total, items, unread] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, page, pageSize, total, unread };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { id, read: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
