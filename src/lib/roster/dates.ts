import { ROSTER_DAYS, type RosterDay } from "@/db/schema";

/** Days after the round's Monday start for each roster label. */
export const ROSTER_DAY_OFFSETS: Record<RosterDay, number> = {
  "Monday A": 0,
  "Tuesday A": 1,
  "Wednesday A": 2,
  "Thursday A": 3,
  "Friday A": 4,
  "Monday B": 7,
  "Tuesday B": 8,
  "Wednesday B": 9,
  "Thursday B": 10,
  "Friday B": 11,
};

/** Parse YYYY-MM-DD as a local calendar date (noon, avoids TZ day shifts). */
export function parseLocalDate(isoDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) throw new Error("Date must be YYYY-MM-DD");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Invalid date");
  }
  return date;
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isMonday(date: Date): boolean {
  return date.getDay() === 1;
}

/** Require a Monday start date for a round. */
export function requireMondayStart(isoDate: string): Date {
  const date = parseLocalDate(isoDate);
  if (!isMonday(date)) {
    throw new Error("Round start date must be a Monday");
  }
  return date;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Calendar date for a venue roster night given the round's Monday start. */
export function rosterDayDate(
  roundStartMonday: Date,
  rosterDay: RosterDay | string
): Date {
  const offset = ROSTER_DAY_OFFSETS[rosterDay as RosterDay];
  if (offset == null) {
    throw new Error(`Unknown roster day "${rosterDay}"`);
  }
  return addDays(roundStartMonday, offset);
}

export function rosterSchedule(roundStartMonday: Date) {
  return ROSTER_DAYS.map((label) => ({
    label,
    date: rosterDayDate(roundStartMonday, label),
  }));
}

export function isRosterDay(value: string): value is RosterDay {
  return (ROSTER_DAYS as readonly string[]).includes(value);
}
