import { Inject, Injectable, StreamableFile } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import type { AIProvider } from '../integrations/ai/ai.provider';
import type { FileStorageProvider } from '../integrations/storage/file-storage.provider';
import { AI_PROVIDER, FILE_STORAGE, VOICE_PROVIDER } from '../integrations/tokens';
import type { VoiceProvider } from '../integrations/voice/voice.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(VOICE_PROVIDER) private readonly voice: VoiceProvider,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
    @Inject(FILE_STORAGE) private readonly storage: FileStorageProvider,
  ) {}

  async list(query: { status?: string; callType?: string; leadId?: string }) {
    return this.prisma.call.findMany({
      where: {
        status: query.status ? (query.status as 'COMPLETED') : undefined,
        callType: query.callType ? (query.callType as 'MANUAL') : undefined,
        leadId: query.leadId,
      },
      orderBy: { startedAt: 'desc' },
      include: {
        lead: { select: { id: true, name: true, shopName: true } },
        employee: { select: { firstName: true, lastName: true } },
        recording: { select: { id: true, durationSeconds: true, mimeType: true } },
      },
    });
  }

  async createManual(
    input: {
      leadId: string;
      startedAt?: string;
      durationSeconds?: number;
      status?: 'COMPLETED' | 'MISSED' | 'ANSWERED' | 'FAILED';
      notes?: string;
      outcome?: string;
      followUpAt?: string;
    },
    actor: Actor,
  ) {
    const lead = await this.requireLead(input.leadId);
    const call = await this.prisma.call.create({
      data: {
        leadId: lead.id,
        customerId: lead.customer?.id,
        employeeId: actor.id,
        startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
        durationSeconds: input.durationSeconds ?? 0,
        callType: 'MANUAL',
        status: input.status ?? 'COMPLETED',
        notes: input.notes,
        outcome: input.outcome,
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : undefined,
      },
    });
    await this.prisma.leadActivity.create({
      data: { leadId: lead.id, userId: actor.id, type: 'CALL_MADE', summary: 'Manual call logged' },
    });
    if (input.status === 'MISSED' && lead.assignedUserId) {
      await this.notifications.notifyUser(lead.assignedUserId, {
        type: 'MISSED_CALL',
        title: 'Missed call',
        body: `${lead.name} has a missed call.`,
        entityType: 'Call',
        entityId: call.id,
      });
    }
    return call;
  }

  async startVoice(leadId: string, utterance: string | undefined, actor: Actor) {
    const lead = await this.requireLead(leadId);
    const documents = await this.prisma.knowledgeBaseDocument.findMany({
      where: { isActive: true, knowledgeBase: { isActive: true } },
      include: { knowledgeBase: true },
    });
    const question = utterance?.trim() || 'What warranty do you provide for AIJewel?';
    const answer = await this.ai.generateResponse({
      message: question,
      documents: documents.map((doc) => ({
        title: doc.title,
        content: doc.content,
        category: doc.knowledgeBase.category,
      })),
    });
    const session = await this.voice.startCall({
      customerName: lead.name,
      shopName: lead.shopName,
      utterance: question,
      faq: { text: answer.text, confident: !answer.escalateToHuman },
    });
    const transcript = await this.voice.getTranscript(session.providerCallId);
    const status = await this.voice.getCallStatus(session.providerCallId);
    const recording = await this.voice.getRecording(session.providerCallId);
    const call = await this.prisma.call.create({
      data: {
        leadId: lead.id,
        customerId: lead.customer?.id,
        employeeId: actor.id,
        startedAt: new Date(),
        durationSeconds: recording.durationSeconds,
        callType: 'VOICE_BOT',
        status: status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
        outcome: session.outcome,
        transcript,
        summary: session.escalateToHuman
          ? 'Voice bot transferred the caller to a human.'
          : 'Voice bot qualified the caller and requested a meeting.',
        voiceState: session.finalState,
        notes: session.requirement,
      },
    });
    const saved = await this.storage.save({
      key: `${call.id}.wav`,
      body: recording.body,
      contentType: recording.contentType,
    });
    await this.prisma.callRecording.create({
      data: {
        callId: call.id,
        storageKey: saved.key,
        fileName: `${call.id}.wav`,
        mimeType: recording.contentType,
        byteSize: saved.size,
        durationSeconds: recording.durationSeconds,
      },
    });
    await this.voice.endCall(session.providerCallId);
    await this.prisma.lead.update({ where: { id: lead.id }, data: { lastContactAt: new Date() } });
    await this.prisma.leadActivity.createMany({
      data: [
        { leadId: lead.id, userId: actor.id, type: 'CALL_MADE', summary: 'Voice bot call completed' },
        { leadId: lead.id, userId: actor.id, type: 'RECORDING_ADDED', summary: 'Call recording stored' },
      ],
    });
    if (session.escalateToHuman) {
      await this.prisma.followUp.create({
        data: {
          leadId: lead.id,
          userId: lead.assignedUserId ?? actor.id,
          dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
          notes: 'Voice bot escalated this caller to a human.',
        },
      });
    }
    await this.audit.record({
      userId: actor.id,
      action: 'VOICE_CALL_COMPLETED',
      entity: 'Call',
      entityId: call.id,
      after: { outcome: session.outcome },
    });
    return { callId: call.id, outcome: session.outcome, transcript, escalateToHuman: session.escalateToHuman, turns: session.turns };
  }

  async addRecording(callId: string, file: { buffer: Buffer; originalname: string; mimetype: string }, actor: Actor) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new AppException('CALL_NOT_FOUND', 'Call was not found', 404);
    const saved = await this.storage.save({
      key: `${callId}-${Date.now()}.bin`,
      body: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
    });
    const recording = await this.prisma.callRecording.upsert({
      where: { callId },
      update: {
        storageKey: saved.key,
        fileName: file.originalname,
        mimeType: file.mimetype,
        byteSize: saved.size,
      },
      create: {
        callId,
        storageKey: saved.key,
        fileName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        byteSize: saved.size,
        durationSeconds: call.durationSeconds,
      },
    });
    await this.prisma.leadActivity.create({
      data: { leadId: call.leadId, userId: actor.id, type: 'RECORDING_ADDED', summary: 'Recording uploaded' },
    });
    return { id: recording.id, byteSize: recording.byteSize };
  }

  async streamRecording(callId: string, actor: Actor) {
    if (!actor.permissions.includes('recordings.read')) {
      throw new AppException('FORBIDDEN', 'You cannot access recordings', 403);
    }
    const recording = await this.prisma.callRecording.findUnique({ where: { callId } });
    if (!recording) throw new AppException('RECORDING_NOT_FOUND', 'Recording was not found', 404);
    const body = await this.storage.read(recording.storageKey);
    await this.audit.record({
      userId: actor.id,
      action: 'RECORDING_ACCESSED',
      entity: 'CallRecording',
      entityId: recording.id,
    });
    return new StreamableFile(body, { type: recording.mimeType, disposition: `inline; filename="${recording.fileName}"` });
  }

  private async requireLead(id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: { customer: { select: { id: true } } },
    });
    if (!lead) throw new AppException('LEAD_NOT_FOUND', 'Lead was not found', 404);
    return lead;
  }
}
