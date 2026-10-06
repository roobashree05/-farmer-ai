import { Injectable } from '@nestjs/common';
import { KNOWLEDGE_CATEGORIES, type KnowledgeCategory } from '@aijewel/shared';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(category?: string) {
    return this.prisma.knowledgeBase.findMany({
      where: category ? { category: category as KnowledgeCategory } : undefined,
      include: { documents: { orderBy: { title: 'asc' } } },
      orderBy: { category: 'asc' },
    });
  }

  async createCategory(input: { category: string; name: string }, actor: Actor) {
    this.assertCategory(input.category);
    const created = await this.prisma.knowledgeBase.create({
      data: { category: input.category as KnowledgeCategory, name: input.name.trim() },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'KNOWLEDGE_UPDATED',
      entity: 'KnowledgeBase',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async updateCategory(id: string, input: { name?: string; isActive?: boolean }, actor: Actor) {
    const existing = await this.mustCategory(id);
    const updated = await this.prisma.knowledgeBase.update({ where: { id }, data: input });
    await this.audit.record({
      userId: actor.id,
      action: 'KNOWLEDGE_UPDATED',
      entity: 'KnowledgeBase',
      entityId: id,
      before: existing,
      after: updated,
    });
    return updated;
  }

  async removeCategory(id: string, actor: Actor) {
    const existing = await this.mustCategory(id);
    await this.prisma.knowledgeBase.delete({ where: { id } });
    await this.audit.record({
      userId: actor.id,
      action: 'KNOWLEDGE_UPDATED',
      entity: 'KnowledgeBase',
      entityId: id,
      before: existing,
    });
    return { id, deleted: true };
  }

  async addDocument(categoryId: string, input: { title: string; content: string }, actor: Actor) {
    await this.mustCategory(categoryId);
    const document = await this.prisma.knowledgeBaseDocument.create({
      data: { knowledgeBaseId: categoryId, title: input.title.trim(), content: input.content.trim() },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'KNOWLEDGE_UPDATED',
      entity: 'KnowledgeBaseDocument',
      entityId: document.id,
      after: { title: document.title },
    });
    return document;
  }

  async updateDocument(id: string, input: { title?: string; content?: string; isActive?: boolean }, actor: Actor) {
    const existing = await this.prisma.knowledgeBaseDocument.findUnique({ where: { id } });
    if (!existing) throw new AppException('KNOWLEDGE_NOT_FOUND', 'Knowledge entry was not found', 404);
    const updated = await this.prisma.knowledgeBaseDocument.update({
      where: { id },
      data: {
        title: input.title?.trim(),
        content: input.content?.trim(),
        isActive: input.isActive,
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'KNOWLEDGE_UPDATED',
      entity: 'KnowledgeBaseDocument',
      entityId: id,
      before: { title: existing.title, content: existing.content, isActive: existing.isActive },
      after: { title: updated.title, content: updated.content, isActive: updated.isActive },
    });
    return updated;
  }

  async removeDocument(id: string, actor: Actor) {
    const existing = await this.prisma.knowledgeBaseDocument.findUnique({ where: { id } });
    if (!existing) throw new AppException('KNOWLEDGE_NOT_FOUND', 'Knowledge entry was not found', 404);
    await this.prisma.knowledgeBaseDocument.delete({ where: { id } });
    await this.audit.record({
      userId: actor.id,
      action: 'KNOWLEDGE_UPDATED',
      entity: 'KnowledgeBaseDocument',
      entityId: id,
      before: { title: existing.title },
    });
    return { id, deleted: true };
  }

  private assertCategory(category: string) {
    if (!KNOWLEDGE_CATEGORIES.includes(category as KnowledgeCategory)) {
      throw new AppException('VALIDATION_ERROR', 'Knowledge category is invalid', 400);
    }
  }

  private async mustCategory(id: string) {
    const category = await this.prisma.knowledgeBase.findUnique({ where: { id } });
    if (!category) throw new AppException('KNOWLEDGE_NOT_FOUND', 'Knowledge category was not found', 404);
    return category;
  }
}
