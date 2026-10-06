import { Injectable } from '@nestjs/common';
import { hash } from 'bcrypt';
import { validatePassword } from '@aijewel/shared';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { redact } from '../common/redact';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto, UpdateUserDto } from './users.dto';

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { name: true, description: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.user.findMany({ select: userSelect, orderBy: { createdAt: 'asc' } });
  }

  assignees() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: 'asc' },
    });
  }

  async create(input: CreateUserDto, actor: Actor) {
    const passwordError = validatePassword(input.password);
    if (passwordError) throw new AppException('VALIDATION_ERROR', passwordError, 400);
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppException('DUPLICATE_RECORD', 'A user with that email already exists', 409);
    const role = await this.prisma.role.findUnique({ where: { name: input.role } });
    if (!role) throw new AppException('ROLE_NOT_FOUND', 'Role was not found', 404);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await hash(input.password, 12),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone,
        roleId: role.id,
      },
      select: userSelect,
    });
    await this.audit.record({
      userId: actor.id,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user.id,
      after: redact(user),
    });
    return user;
  }

  async update(id: string, input: UpdateUserDto, actor: Actor) {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!existing) throw new AppException('USER_NOT_FOUND', 'User was not found', 404);
    if (id === actor.id && input.isActive === false) {
      throw new AppException('CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own user', 400);
    }
    let roleId: string | undefined;
    if (input.role) {
      const role = await this.prisma.role.findUnique({ where: { name: input.role } });
      if (!role) throw new AppException('ROLE_NOT_FOUND', 'Role was not found', 404);
      roleId = role.id;
    }
    let passwordHash: string | undefined;
    if (input.password) {
      const passwordError = validatePassword(input.password);
      if (passwordError) throw new AppException('VALIDATION_ERROR', passwordError, 400);
      passwordHash = await hash(input.password, 12);
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: input.firstName?.trim(),
        lastName: input.lastName?.trim(),
        phone: input.phone,
        isActive: input.isActive,
        roleId,
        passwordHash,
      },
      select: userSelect,
    });
    await this.audit.record({
      userId: actor.id,
      action: input.role && input.role !== existing.role.name ? 'PERMISSION_CHANGED' : 'USER_UPDATED',
      entity: 'User',
      entityId: id,
      before: redact(existing),
      after: redact(user),
    });
    return user;
  }
}
