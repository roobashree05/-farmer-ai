import type { BusyRange, CalendarSlot } from '@aijewel/shared';

export interface CalendarProvider {
  getAvailability(input: { date: string; busy: BusyRange[]; now?: Date }): Promise<CalendarSlot[]>;
  createMeeting(input: { title: string; startIso: string; endIso: string }): Promise<{ externalEventId: string }>;
  cancelMeeting(externalEventId: string): Promise<void>;
  rescheduleMeeting(externalEventId: string, startIso: string, endIso: string): Promise<{ externalEventId: string }>;
}
