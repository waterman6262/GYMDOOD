const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** First day of the month of a "YYYY-MM-DD" date. */
export function monthStartOf(date: string): string {
  return `${date.slice(0, 8)}01`;
}

/**
 * Report range from the URL. Defaults to month-to-date; a reversed range is
 * swapped. Length limits are checked by the database functions.
 */
export function parseRange(params: { from?: unknown; to?: unknown }, today: string): { from: string; to: string } {
  const pick = (v: unknown) => (typeof v === "string" && DATE.test(v) ? v : null);
  const from = pick(params.from) ?? monthStartOf(today);
  const to = pick(params.to) ?? today;
  return from <= to ? { from, to } : { from: to, to: from };
}
