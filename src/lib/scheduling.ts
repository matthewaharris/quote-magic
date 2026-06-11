// Slot math for customer self-scheduling.
//
// Prototype timezone model: all slot timestamps are stored and formatted as
// UTC wall-clock time — "08:00Z" in the DB *means* 8 AM on the contractor's
// clock, and every formatter passes timeZone: "UTC" so it renders the same
// everywhere. A real implementation would store a timezone per contractor.
//
// Availability comes from contractors.availability: per-day open/close
// windows keyed by day-of-week "0" (Sun) … "6" (Sat); a missing day is
// closed. Booked jobs AND busy_blocks rows feed the busy[] intervals.

export const SCHEDULING_WINDOW_DAYS = 10;
const LOOKAHEAD_LIMIT_DAYS = 60; // stop scanning even if few days are open

export interface DayWindow {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

// Keyed by day-of-week "0".."6"; null/absent = closed.
export type WeeklyAvailability = Record<string, DayWindow | null>;

export const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  "1": { start: "08:00", end: "17:00" },
  "2": { start: "08:00", end: "17:00" },
  "3": { start: "08:00", end: "17:00" },
  "4": { start: "08:00", end: "17:00" },
  "5": { start: "08:00", end: "17:00" },
};

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function hmToMinutes(hm: string): number {
  const m = TIME_RE.exec(hm);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Sanitize a jsonb availability value from the DB. Days with malformed or
// inverted windows are treated as closed; a schedule with no open days
// falls back to the default so scheduling never dead-ends entirely.
export function parseAvailability(raw: unknown): WeeklyAvailability {
  const out: WeeklyAvailability = {};
  if (raw && typeof raw === "object") {
    for (const dow of ["0", "1", "2", "3", "4", "5", "6"]) {
      const day = (raw as Record<string, unknown>)[dow];
      if (!day || typeof day !== "object") continue;
      const { start, end } = day as { start?: unknown; end?: unknown };
      if (typeof start !== "string" || typeof end !== "string") continue;
      const s = hmToMinutes(start);
      const e = hmToMinutes(end);
      if (Number.isNaN(s) || Number.isNaN(e) || e <= s) continue;
      out[dow] = { start, end };
    }
  }
  return Object.keys(out).length > 0 ? out : DEFAULT_AVAILABILITY;
}

export function longestWindowMinutes(avail: WeeklyAvailability): number {
  let max = 0;
  for (const day of Object.values(avail)) {
    if (!day) continue;
    max = Math.max(max, hmToMinutes(day.end) - hmToMinutes(day.start));
  }
  return max;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface DaySlots {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Tue, Jun 16"
  slots: string[]; // ISO start timestamps
}

// Round labor estimate up to whole hours, min 1h, capped at the longest
// open day so a big job can still book the contractor's fullest day.
export function jobDurationMinutes(
  estTotalMinutes: number,
  avail: WeeklyAvailability = DEFAULT_AVAILABILITY
): number {
  const rounded = Math.max(60, Math.ceil(estTotalMinutes / 60) * 60);
  return Math.min(rounded, longestWindowMinutes(avail));
}

function overlaps(aStart: Date, aEnd: Date, b: BusyInterval): boolean {
  return aStart < b.end && aEnd > b.start;
}

// The contractor's next N open days starting tomorrow: hourly starts from
// the day's open time that fit before closing and don't collide with booked
// jobs or busy blocks. A job that fills a day's whole window offers only
// the opening start; days too short for the job offer nothing.
export function generateSlots(input: {
  durationMinutes: number;
  busy: BusyInterval[];
  availability?: WeeklyAvailability;
  now?: Date;
}): DaySlots[] {
  const duration = input.durationMinutes;
  const avail = input.availability ?? DEFAULT_AVAILABILITY;
  const now = input.now ?? new Date();
  const days: DaySlots[] = [];

  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  for (
    let scanned = 0;
    days.length < SCHEDULING_WINDOW_DAYS && scanned < LOOKAHEAD_LIMIT_DAYS;
    scanned++
  ) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const window = avail[String(cursor.getUTCDay())];
    if (!window) continue; // closed day

    const open = hmToMinutes(window.start);
    const close = hmToMinutes(window.end);
    // Days shorter than the job offer nothing (lastStart < open) — only
    // the contractor's longest day can host a window-filling job.
    const lastStart = close - duration;

    const slots: string[] = [];
    for (let m = open; m <= lastStart; m += 60) {
      const start = new Date(cursor);
      start.setUTCHours(Math.floor(m / 60), m % 60, 0, 0);
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
