import { describe, expect, test } from "vitest";
import { addDays, bangkokToIso, formatTime, weekStart } from "@/lib/classes/time";

describe("class time helpers", () => {
  test("week_start_monday", () => {
    expect(weekStart("2026-11-04")).toBe("2026-11-02");
  });

  test("week_start_sunday", () => {
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
  });

  test("week_start_on_monday_is_itself", () => {
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
  });

  test("bangkok_to_iso", () => {
    expect(bangkokToIso("2026-11-05", "00:30")).toBe("2026-11-04T17:30:00.000Z");
  });

  test("format_time", () => {
    expect(formatTime("2026-11-04T11:00:00Z")).toBe("18:00");
  });

  test("add_days_month_end", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
});
