import { randomUUID } from 'crypto';
import { buildAvailability, type BusyRange } from '@aijewel/shared';
import type { CalendarProvider } from './calendar.provider';

export class MockCalendarProvider implements CalendarProvider {
  async getAvailability(input: { date: string; busy: BusyRange[]; now?: Date }) {
    return buildAvailability(input);
  }

  async createMeeting() {
    return { externalEventId: `mock-evt-${randomUUID()}` };
  }

  async cancelMeeting() {
    return undefined;
  }

  async rescheduleMeeting(externalEventId: string) {
    return { externalEventId };
  }
}
