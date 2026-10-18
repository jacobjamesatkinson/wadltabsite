/** Stored as 24h "HH:MM" from `<input type="time">`. */
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeslotTime(value: string): string {
  const trimmed = value.trim();
  if (TIME_RE.test(trimmed)) return trimmed;

  // Accept H:MM
  const short = /^(\d):([0-5]\d)$/.exec(trimmed);
  if (short) return `0${short[1]}:${short[2]}`;

  // Accept 4:00pm / 4:00 PM
  const ampm = /^(\d{1,2}):([0-5]\d)\s*(am|pm)$/i.exec(trimmed);
  if (ampm) {
    let hours = Number(ampm[1]);
    const minutes = ampm[2]!;
    const period = ampm[3]!.toLowerCase();
    if (hours < 1 || hours > 12) throw new Error("Time must be HH:MM");
    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  throw new Error("Time must be HH:MM");
}

/** Minutes from midnight for sorting. */
export function timeslotMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Display e.g. "4:00 pm". */
export function formatTimeslotTime(hhmm: string): string {
  const match = TIME_RE.exec(hhmm.trim());
  if (!match) return hhmm;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}
