import { Inject, Injectable } from '@nestjs/common';
import {
  assertMeetingDuration,
  isValidEmail,
  normalizePhone,
  zonedTimeToUtc,
  type BusyRange,
} from '@aijewel/shared';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import type { CalendarProvider } from '../integrations/calendar/calendar.provider';
import { CALENDAR_PROVIDER } from '../integrations/tokens';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const TIME_ZONE = 'Asia/Kolkata';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(CALENDAR_PROVIDER) private readonly calendar: CalendarProvider,
  ) {}

  async list(query: { status?: string; leadId?: string }) {
    return this.prisma.meeting.findMany({
      where: {
        status: query.status ? (query.status as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED') : undefined,
        leadId: query.leadId,
      },
      orderBy: { startAt: 'asc' },
      include: { lead: { select: { id: true, name: true, shopName: true } } },
    });
  }

  async availability(date: string, hostUserId?: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppException('VALIDATION_ERROR', 'Date must be YYYY-MM-DD', 400);
    }
    const dayStart = zonedTimeToUtc(date, '00:00', TIME_ZONE);
    const dayEnd = zonedTimeToUtc(date, '23:59', TIME_ZONE);
    const meetings = await this.prisma.meeting.findMany({
      where: {
        status: 'SCHEDULED',
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
        ...(hostUserId ? { hostUserId } : {}),
      },
    });
    const busy: BusyRange[] = meetings.map((meeting) => ({
      startIso: meeting.startAt.toISOString(),
      endIso: meeting.endAt.toISOString(),
    }));
    return this.calendar.getAvailability({ date, busy });
  }

  async book(
    input: {
      leadId: string;
      hostUserId?: string;
      date: string;
      time: string;
      durationMinutes: number;
      meetingType: string;
      attendeeName: string;
      attendeePhone: string;
      attendeeEmail?: string;
      notes?: string;
    },
    actor: Actor,
  ) {
    try {
      assertMeetingDuration(input.durationMinutes);
    } catch (error) {
      throw new AppException('VALIDATION_ERROR', error instanceof Error ? error.message : 'Invalid duration', 400);
    }
    if (!/^\d{2}:\d{2}$/.test(input.time)) throw new AppException('VALIDATION_ERROR', 'Time must be HH:mm', 400);
    const phone = normalizePhone(input.attendeePhone);
    if (!phone) throw new AppException('VALIDATION_ERROR', 'Phone number is invalid', 400);
    if (!isValidEmail(input.attendeeEmail)) throw new AppException('VALIDATION_ERROR', 'Email is invalid', 400);
    const lead = await this.prisma.lead.findFirst({ where: { id: input.leadId, deletedAt: null } });
    if (!lead) throw new AppException('LEAD_NOT_FOUND', 'Lead was not found', 404);
    const hostUserId = input.hostUserId ?? actor.id;
    const host = await this.prisma.user.findFirst({ where: { id: hostUserId, isActive: true } });
    if (!host) throw new AppException('USER_NOT_FOUND', 'Meeting host was not found', 404);
    const start = zonedTimeToUtc(input.date, input.time, TIME_ZONE);
    const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);
    const opening = zonedTimeToUtc(input.date, '09:00', TIME_ZONE);
    const closing = zonedTimeToUtc(input.date, '17:00', TIME_ZONE);
    if (start < opening || end > closing || start <= new Date()) {
      throw new AppException('MEETING_SLOT_UNAVAILABLE', 'Choose a future slot between 09:00 and 17:00', 400);
    }
    const conflict = await this.prisma.meeting.findFirst({
      where: { hostUserId, status: 'SCHEDULED', startAt: { lt: end }, endAt: { gt: start } },
    });
    if (conflict) throw new AppException('MEETING_SLOT_UNAVAILABLE', 'That time is already booked', 409);
    const external = await this.calendar.createMeeting({
      title: `${input.meetingType} with ${input.attendeeName}`,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    });
    const meeting = await this.prisma.meeting.create({
      data: {
        leadId: lead.id,
        hostUserId,
        title: `${input.meetingType} · ${input.attendeeName}`,
        startAt: start,
        endAt: end,
        durationMinutes: input.durationMinutes,
        meetingType: input.meetingType,
        attendeeName: input.attendeeName.trim(),
        attendeePhone: phone,
        attendeeEmail: input.attendeeEmail?.trim().toLowerCase(),
        externalEventId: external.externalEventId,
        notes: input.notes,
      },
    });
    const meetingStatus = await this.prisma.leadStatusDefinition.findUnique({ where: { code: 'MEETING_SCHEDULED' } });
    if (meetingStatus && ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP'].includes(lead.statusId) === false) {
      const current = await this.prisma.leadStatusDefinition.findUnique({ where: { id: lead.statusId } });
      if (current && ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP'].includes(current.code)) {
        await this.prisma.lead.update({ where: { id: lead.id }, data: { statusId: meetingStatus.id } });
      }
    } else if (meetingStatus) {
      const current = await this.prisma.leadStatusDefinition.findUnique({ where: { id: lead.statusId } });
      if (current && ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP'].includes(current.code)) {
        await this.prisma.lead.update({ where: { id: lead.id }, data: { statusId: meetingStatus.id } });
      }
    }
    await this.prisma.leadActivity.create({
      data: { leadId: lead.id, userId: actor.id, type: 'MEETING_BOOKED', summary: `Meeting booked for ${input.date} ${input.time}` },
    });
    await this.notifications.notifyUser(hostUserId, {
      type: 'MEETING_BOOKED',
      title: 'Meeting booked',
      body: `${input.attendeeName} booked ${input.meetingType} on ${input.date} at ${input.time}.`,
      entityType: 'Meeting',
      entityId: meeting.id,
    });
    await this.audit.record({
      userId: actor.id,
      action: 'MEETING_BOOKED',
      entity: 'Meeting',
      entityId: meeting.id,
      after: { leadId: lead.id, start: start.toISOString() },
    });
    return meeting;
  }

  async cancel(id: string, actor: Actor) {
    const meeting = await this.must(id);
    if (meeting.status !== 'SCHEDULED') throw new AppException('INVALID_TRANSITION', 'Only scheduled meetings can be cancelled', 400);
    if (meeting.externalEventId) await this.calendar.cancelMeeting(meeting.externalEventId);
    const updated = await this.prisma.meeting.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.prisma.leadActivity.create({
      data: { leadId: meeting.leadId, userId: actor.id, type: 'MEETING_CANCELLED', summary: 'Meeting cancelled' },
    });
    await this.notifications.notifyUser(meeting.hostUserId, {
      type: 'MEETING_CANCELLED',
      title: 'Meeting cancelled',
      body: meeting.title,
      entityType: 'Meeting',
      entityId: id,
    });
    return updated;
  }

  async reschedule(id: string, input: { date: string; time: string; durationMinutes: number }, actor: Actor) {
    const meeting = await this.must(id);
    if (meeting.status !== 'SCHEDULED') throw new AppException('INVALID_TRANSITION', 'Only scheduled meetings can be rescheduled', 400);
    assertMeetingDuration(input.durationMinutes);
    const start = zonedTimeToUtc(input.date, input.time, TIME_ZONE);
    const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);
    const conflict = await this.prisma.meeting.findFirst({
      where: { id: { not: id }, hostUserId: meeting.hostUserId, status: 'SCHEDULED', startAt: { lt: end }, endAt: { gt: start } },
    });
    if (conflict || start <= new Date()) {
      throw new AppException('MEETING_SLOT_UNAVAILABLE', 'That time is not available', 409);
    }
    if (meeting.externalEventId) {
      await this.calendar.rescheduleMeeting(meeting.externalEventId, start.toISOString(), end.toISOString());
    }
    const updated = await this.prisma.meeting.update({
      where: { id },
      data: { startAt: start, endAt: end, durationMinutes: input.durationMinutes },
    });
    await this.prisma.leadActivity.create({
      data: { leadId: meeting.leadId, userId: actor.id, type: 'MEETING_RESCHEDULED', summary: `Meeting moved to ${input.date} ${input.time}` },
    });
    return updated;
  }

  async events(from: string, to: string) {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new AppException('VALIDATION_ERROR', 'from and to must be dates', 400);
    }
    const [meetings, campaigns] = await Promise.all([
      this.prisma.meeting.findMany({ where: { startAt: { lt: end }, endAt: { gt: start } } }),
      this.prisma.campaign.findMany({
        where: {
          OR: [
            { startDate: { gte: start, lte: end } },
            { endDate: { gte: start, lte: end } },
          ],
        },
      }),
    ]);
    return [
      ...meetings.map((meeting) => ({
        id: meeting.id,
        type: 'MEETING',
        title: meeting.title,
        start: meeting.startAt.toISOString(),
        end: meeting.endAt.toISOString(),
        status: meeting.status,
        platform: meeting.meetingType,
      })),
      ...campaigns.map((campaign) => ({
        id: campaign.id,
        type: campaign.kind,
        title: campaign.name,
        start: (campaign.startDate ?? campaign.createdAt).toISOString(),
        end: (campaign.endDate ?? campaign.startDate ?? campaign.createdAt).toISOString(),
        status: campaign.status,
        platform: campaign.platform,
      })),
    ];
  }

  async sendReminders() {
    const soon = new Date(Date.now() + 30 * 60 * 1000);
    const meetings = await this.prisma.meeting.findMany({
      where: { status: 'SCHEDULED', reminderSentAt: null, startAt: { lte: soon, gte: new Date() } },
    });
    for (const meeting of meetings) {
      await this.notifications.notifyUser(meeting.hostUserId, {
        type: 'MEETING_REMINDER',
        title: 'Meeting reminder',
        body: `${meeting.title} starts soon.`,
        entityType: 'Meeting',
        entityId: meeting.id,
      });
      await this.prisma.meeting.update({ where: { id: meeting.id }, data: { reminderSentAt: new Date() } });
    }
  }

  private async must(id: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new AppException('MEETING_NOT_FOUND', 'Meeting was not found', 404);
    return meeting;
  }
}
