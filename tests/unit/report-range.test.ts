import { describe, expect, test } from "vitest";
import { monthStartOf, parseRange } from "@/lib/reports/range";

describe("report range", () => {
  test("month_start", () => {
    expect(monthStartOf("2026-11-04")).toBe("2026-11-01");
  });

  test("default_range_is_month_to_date", () => {
    expect(parseRange({}, "2026-11-04")).toEqual({ from: "2026-11-01", to: "2026-11-04" });
  });

  test("invalid_dates_fall_back", () => {
    expect(parseRange({ from: "nope", to: "2026-13" }, "2026-11-04")).toEqual({ from: "2026-11-01", to: "2026-11-04" });
  });

  test("reversed_range_swapped", () => {
    expect(parseRange({ from: "2026-11-10", to: "2026-11-02" }, "2026-11-04")).toEqual({
      from: "2026-11-02",
      to: "2026-11-10",
    });
  });
});
