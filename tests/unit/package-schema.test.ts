import { describe, expect, test } from "vitest";
import { packageTypeSchema } from "@/lib/packages/schema";

const base = { name: "แพ็กเกจ", price: 900, seats: 1 };

function firstError(input: unknown) {
  const result = packageTypeSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0].message;
}

describe("packageTypeSchema", () => {
  test("visits kind requires a visit count", () => {
    expect(firstError({ ...base, kind: "visits", duration_days: 60 })).toBe("กรุณาระบุจำนวนครั้ง");
  });

  test("pt kind requires sessions above zero", () => {
    expect(firstError({ ...base, kind: "pt", duration_days: 90, pt_sessions: 0 })).toBe(
      "กรุณาระบุจำนวนชั่วโมง PT",
    );
  });

  test("negative price is rejected", () => {
    expect(firstError({ ...base, kind: "duration", duration_days: 30, price: -1 })).toBe(
      "ราคาต้องไม่ติดลบ",
    );
  });

  test("day kind always lasts one day", () => {
    const result = packageTypeSchema.parse({ ...base, kind: "day", duration_days: 30 });
    expect(result.duration_days).toBe(1);
  });

  test("valid visits package parses", () => {
    const result = packageTypeSchema.parse({ ...base, kind: "visits", duration_days: 60, visits: 10 });
    expect(result).toMatchObject({ kind: "visits", visits: 10, duration_days: 60 });
  });
});
