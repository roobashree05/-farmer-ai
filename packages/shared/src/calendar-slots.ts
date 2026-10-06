export interface BusyRange {
  startIso: string;
  endIso: string;
}

export interface CalendarSlot {
  time: string;
  status: 'AVAILABLE' | 'BUSY';
  startIso: string;
  endIso: string;
}

export function zonedTimeToUtc(date: string, time: string, timeZone = 'Asia/Kolkata'): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(guess).map((part) => [part.type, part.value]));
  const hourValue = parts.hour === '24' ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hourValue,
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
}

function overlaps(start: Date, end: Date, busy: BusyRange[]): boolean {
  return busy.some((range) => {
    const busyStart = new Date(range.startIso);
    const busyEnd = new Date(range.endIso);
    return start < busyEnd && end > busyStart;
  });
}

export function buildAvailability(input: {
  date: string;
  busy: BusyRange[];
  now?: Date;
  timeZone?: string;
  openingHour?: number;
  closingHour?: number;
  stepMinutes?: number;
}): CalendarSlot[] {
  const timeZone = input.timeZone ?? 'Asia/Kolkata';
  const opening = input.openingHour ?? 9;
  const closing = input.closingHour ?? 17;
  const step = input.stepMinutes ?? 30;
  const now = input.now ?? new Date();
  const slots: CalendarSlot[] = [];

  for (let minutes = opening * 60; minutes < closing * 60; minutes += step) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const start = zonedTimeToUtc(input.date, time, timeZone);
    const end = new Date(start.getTime() + step * 60 * 1000);
    const status = start <= now || overlaps(start, end, input.busy) ? 'BUSY' : 'AVAILABLE';
    slots.push({ time, status, startIso: start.toISOString(), endIso: end.toISOString() });
  }

  return slots;
}

export const MEETING_DURATIONS = [15, 30, 45, 60] as const;

export function assertMeetingDuration(duration: number): void {
  if (!MEETING_DURATIONS.includes(duration as (typeof MEETING_DURATIONS)[number])) {
    throw new Error('Meeting duration must be 15, 30, 45, or 60 minutes');
  }
}
