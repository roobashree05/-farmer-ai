import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly attempts = new Map<string, { count: number; reset: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, ip?: string) {
    this.assertRate(ip ?? 'unknown');
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const matches = user ? await compare(password, user.passwordHash) : false;
    if (!user || !user.isActive || !matches) {
      await this.audit.record({
        action: 'LOGIN_FAILED',
        entity: 'User',
        after: { email: email.toLowerCase() },
        ip,
      });
      throw new AppException('UNAUTHORIZED', 'Email or password is incorrect', 401);
    }
    const actor = this.toActor(user);
    const tokens = await this.issueTokens(actor);
    await this.audit.record({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ip });
    return { ...tokens, user: actor };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hash(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      if (stored?.revokedAt) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new AppException('UNAUTHORIZED', 'Refresh token is not valid', 401);
    }
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user || !user.isActive) throw new AppException('UNAUTHORIZED', 'Session is no longer valid', 401);
    return this.issueTokens(this.toActor(user));
  }

  async logout(refreshToken: string, actor?: Actor) {
    const tokenHash = this.hash(refreshToken);
    await this.prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
    if (actor) {
      await this.audit.record({ userId: actor.id, action: 'LOGOUT', entity: 'User', entityId: actor.id });
    }
    return { loggedOut: true };
  }

  me(actor: Actor) {
    return actor;
  }

  private async issueTokens(actor: Actor) {
    const accessToken = await this.jwt.signAsync(
      { sub: actor.id, email: actor.email, role: actor.role },
      { expiresIn: this.config.get('JWT_ACCESS_TTL', '15m') },
    );
    const refreshToken = randomBytes(32).toString('hex');
    const ttl = this.config.get<string>('JWT_REFRESH_TTL') ?? '7d';
    const expiresAt = new Date(Date.now() + this.ttlMs(ttl));
    await this.prisma.refreshToken.create({
      data: { userId: actor.id, tokenHash: this.hash(refreshToken), expiresAt },
    });
    return { accessToken, refreshToken, expiresIn: this.config.get('JWT_ACCESS_TTL', '15m') };
  }

  private toActor(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: { name: Actor['role']; permissions: { permission: { code: string } }[] };
  }): Actor {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      permissions: user.role.permissions.map((item) => item.permission.code),
    };
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private ttlMs(ttl: string) {
    const match = /^(\d+)([mhd])$/.exec(ttl);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const amount = Number(match[1]);
    if (match[2] === 'm') return amount * 60 * 1000;
    if (match[2] === 'h') return amount * 60 * 60 * 1000;
    return amount * 24 * 60 * 60 * 1000;
  }

  private assertRate(ip: string) {
    const now = Date.now();
    const current = this.attempts.get(ip);
    if (!current || current.reset < now) {
      this.attempts.set(ip, { count: 1, reset: now + 60_000 });
      return;
    }
    current.count += 1;
    if (current.count > 10) {
      throw new AppException('RATE_LIMITED', 'Too many login attempts. Try again in a minute.', 429);
    }
  }
}
