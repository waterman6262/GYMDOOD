import { describe, expect, test } from "vitest";
import { memberSchema } from "@/lib/members/schema";

function firstError(input: unknown) {
  const result = memberSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0].message;
}

describe("memberSchema", () => {
  test("blank name is rejected", () => {
    expect(firstError({ name: "  " })).toBe("กรุณากรอกชื่อ");
  });

  test("10-digit mobile passes", () => {
    expect(memberSchema.safeParse({ name: "สมชาย", phone: "0812345678" }).success).toBe(true);
  });

  test("phone with dashes passes", () => {
    expect(memberSchema.safeParse({ name: "สมชาย", phone: "081-234-5678" }).success).toBe(true);
  });

  test("short phone is rejected", () => {
    expect(firstError({ name: "สมชาย", phone: "12345" })).toBe(
      "เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0",
    );
  });

  test("phone is optional, empty string included", () => {
    expect(memberSchema.safeParse({ name: "สมชาย" }).success).toBe(true);
    expect(memberSchema.safeParse({ name: "สมชาย", phone: "" }).success).toBe(true);
  });
});
