// Calendar helpers for class schedules. Dates are "YYYY-MM-DD" strings meaning
// a day in Bangkok; arithmetic is done in UTC so the host's time zone never matters.

const DAY_MS = 86_400_000;

const toUtc = (date: string) => new Date(`${date}T00:00:00Z`);
const toDate = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(date: string, n: number): string {
  return toDate(new Date(toUtc(date).getTime() + n * DAY_MS));
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const day = toUtc(date).getUTCDay(); // 0 = Sunday
  return addDays(date, day === 0 ? -6 : 1 - day);
}

/** A Bangkok wall-clock date and "HH:mm" as an ISO timestamp (Thailand is UTC+7, no DST). */
export function bangkokToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Bangkok",
});

/** "HH:mm" in Bangkok time. */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** Today's date in Bangkok, "YYYY-MM-DD". */
export function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

/** The Bangkok date of a timestamp, "YYYY-MM-DD". */
export function bangkokDateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(iso));
}
