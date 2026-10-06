import { Injectable } from '@nestjs/common';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { PrismaService } from '../prisma/prisma.service';
import { leadInclude, presentLead } from './lead.presenter';

@Injectable()
export class LeadWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async byLeadId(id: string, actor: Actor) {
    const lead = await this.prisma.lead.findFirst({ where: { id, deletedAt: null }, include: leadInclude });
    if (!lead) throw new AppException('LEAD_NOT_FOUND', 'Lead was not found', 404);
    return this.compose(lead.id, presentLead(lead), actor);
  }

  async byCustomerId(id: string, actor: Actor) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new AppException('CUSTOMER_NOT_FOUND', 'Customer was not found', 404);
    const lead = await this.prisma.lead.findFirst({
      where: { id: customer.leadId, deletedAt: null },
      include: leadInclude,
    });
    if (!lead) throw new AppException('LEAD_NOT_FOUND', 'Lead was not found', 404);
    return this.compose(lead.id, presentLead(lead), actor);
  }

  private async compose(
    leadId: string,
    lead: ReturnType<typeof presentLead>,
    actor: Actor,
  ) {
    const can = (permission: string) => actor.permissions.includes(permission);
    const [notes, timeline, conversation, calls, meetings, campaigns, aiMessages, followUps, customer] = await Promise.all([
      this.prisma.leadNote.findMany({
        where: { leadId },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.leadActivity.findMany({
        where: { leadId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
      can('whatsapp.read')
        ? this.prisma.whatsAppConversation.findFirst({
            where: { leadId },
            orderBy: { lastMessageAt: 'desc' },
            include: { messages: { orderBy: { createdAt: 'asc' }, take: 100 } },
          })
        : null,
      can('calls.read')
        ? this.prisma.call.findMany({
            where: { leadId },
            orderBy: { startedAt: 'desc' },
            include: {
              employee: { select: { firstName: true, lastName: true } },
              recording: true,
            },
          })
        : [],
      can('meetings.read')
        ? this.prisma.meeting.findMany({ where: { leadId }, orderBy: { startAt: 'desc' } })
        : [],
      can('campaigns.read')
        ? this.prisma.campaignMessage.findMany({
            where: { leadId },
            orderBy: { createdAt: 'desc' },
            include: { campaign: { select: { id: true, name: true, status: true, kind: true } } },
          })
        : [],
      this.prisma.aIMessage.findMany({
        where: { conversation: { leadId } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.followUp.findMany({ where: { leadId }, orderBy: { dueAt: 'asc' } }),
      this.prisma.customer.findUnique({ where: { leadId } }),
    ]);

    return {
      lead,
      customer,
      notes: notes.map((note) => ({
        id: note.id,
        body: note.body,
        createdAt: note.createdAt.toISOString(),
        author: `${note.user.firstName} ${note.user.lastName}`,
      })),
      timeline: timeline.map((item) => ({
        id: item.id,
        type: item.type,
        summary: item.summary,
        createdAt: item.createdAt.toISOString(),
        actor: item.user ? `${item.user.firstName} ${item.user.lastName}` : null,
      })),
      whatsapp: conversation
        ? {
            id: conversation.id,
            contactPhone: conversation.contactPhone,
            messages: conversation.messages.map((message) => ({
              id: message.id,
              direction: message.direction,
              body: message.body,
              status: message.status,
              createdAt: message.createdAt.toISOString(),
            })),
          }
        : null,
      calls: calls.map((call) => ({
        id: call.id,
        startedAt: call.startedAt.toISOString(),
        durationSeconds: call.durationSeconds,
        callType: call.callType,
        status: call.status,
        notes: call.notes,
        outcome: call.outcome,
        employee: `${call.employee.firstName} ${call.employee.lastName}`,
        transcript: call.transcript,
        summary: call.summary,
        recording:
          call.recording && can('recordings.read')
            ? {
                id: call.recording.id,
                url: `/api/calls/${call.id}/recording`,
                mimeType: call.recording.mimeType,
                byteSize: call.recording.byteSize,
                durationSeconds: call.recording.durationSeconds,
              }
            : null,
      })),
      meetings: meetings.map((meeting) => ({
        ...meeting,
        startAt: meeting.startAt.toISOString(),
        endAt: meeting.endAt.toISOString(),
        createdAt: meeting.createdAt.toISOString(),
        updatedAt: meeting.updatedAt.toISOString(),
      })),
      campaigns: campaigns.map((message) => ({
        id: message.id,
        campaignId: message.campaign.id,
        name: message.campaign.name,
        status: message.campaign.status,
        kind: message.campaign.kind,
        renderedBody: message.renderedBody,
        sentAt: message.sentAt?.toISOString() ?? null,
      })),
      aiMessages: aiMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        confidence: message.confidence,
        escalateToHuman: message.escalateToHuman,
        createdAt: message.createdAt.toISOString(),
      })),
      followUps: followUps.map((followUp) => ({
        id: followUp.id,
        dueAt: followUp.dueAt.toISOString(),
        status: followUp.status,
        notes: followUp.notes,
      })),
    };
  }
}
