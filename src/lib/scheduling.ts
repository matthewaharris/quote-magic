// Slot math for customer self-scheduling.
//
// Prototype timezone model: all slot timestamps are stored and formatted as
// UTC wall-clock time — "08:00Z" in the DB *means* 8 AM on the contractor's
// clock, and every formatter passes timeZone: "UTC" so it renders the same
// everywhere. A real implementation would store a timezone per contractor.

export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 17;
export const SCHEDULING_WINDOW_DAYS = 10;
const WORKDAY_MINUTES = (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60;

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface DaySlots {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Tue, Jun 16"
  slots: string[]; // ISO start timestamps
}

// Round labor estimate up to whole hours, min 1h, capped at one workday.
export function jobDurationMinutes(estTotalMinutes: number): number {
  const rounded = Math.max(60, Math.ceil(estTotalMinutes / 60) * 60);
  return Math.min(rounded, WORKDAY_MINUTES);
}

function overlaps(aStart: Date, aEnd: Date, b: BusyInterval): boolean {
  return aStart < b.end && aEnd > b.start;
}

// Next N business days starting tomorrow, hourly starts that fit before
// closing time and don't collide with the contractor's booked jobs.
// Full-day jobs only offer the 8:00 start.
export function generateSlots(input: {
  durationMinutes: number;
  busy: BusyInterval[];
  now?: Date;
}): DaySlots[] {
  const duration = input.durationMinutes;
  const now = input.now ?? new Date();
  const days: DaySlots[] = [];

  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  while (days.length < SCHEDULING_WINDOW_DAYS) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dow = cursor.getUTCDay();
    if (dow === 0 || dow === 6) continue; // weekends

    const slots: string[] = [];
    const lastStartHour =
      duration >= WORKDAY_MINUTES
        ? BUSINESS_START_HOUR
        : BUSINESS_END_HOUR - Math.ceil(duration / 60);

    for (let h = BUSINESS_START_HOUR; h <= lastStartHour; h++) {
      const start = new Date(cursor);
      start.setUTCHours(h, 0, 0, 0);
      const end = new Date(start.getTime() + duration * 60_000);
      if (!input.busy.some((b) => overlaps(start, end, b))) {
        slots.push(start.toISOString());
      }
    }

    days.push({
      date: cursor.toISOString().slice(0, 10),
      label: formatDayLabel(cursor),
      slots,
    });
  }

  return days;
}

export function formatDayLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatSlotTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function formatSlotRange(startIso: string, endIso: string): string {
  const day = formatDayLabel(new Date(startIso));
  return `${day}, ${formatSlotTime(startIso)} – ${formatSlotTime(endIso)}`;
}
