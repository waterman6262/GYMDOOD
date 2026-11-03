import { describe, expect, test } from "vitest";
import { shopSettingsSchema, staffAccountSchema } from "@/lib/settings/schema";

function firstError(schema: typeof shopSettingsSchema | typeof staffAccountSchema, input: unknown) {
  const result = schema.safeParse(input);
  return result.success ? undefined : result.error.issues[0].message;
}

const shop = { gym_name: "GYMDOOD", address: "", phone: "", receipt_footer: "" };
const PROMPTPAY_ERROR = "เลข PromptPay ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก";

describe("shopSettingsSchema", () => {
  test("mobile number with dashes is stored as digits", () => {
    expect(shopSettingsSchema.parse({ ...shop, promptpay_id: "081-234-5678" }).promptpay_id).toBe("0812345678");
  });

  test("13-digit id passes", () => {
    expect(shopSettingsSchema.safeParse({ ...shop, promptpay_id: "1234567890123" }).success).toBe(true);
  });

  test("short number is rejected", () => {
    expect(firstError(shopSettingsSchema, { ...shop, promptpay_id: "12345" })).toBe(PROMPTPAY_ERROR);
  });

  test("empty promptpay is allowed until the owner sets it", () => {
    expect(shopSettingsSchema.safeParse({ ...shop, promptpay_id: "" }).success).toBe(true);
  });
});

describe("staffAccountSchema", () => {
  const account = { name: "พนักงานใหม่", email: "new@gym.test", password: "pass-1234", role: "staff" };

  test("valid account passes", () => {
    expect(staffAccountSchema.safeParse(account).success).toBe(true);
  });

  test("short password is rejected", () => {
    expect(firstError(staffAccountSchema, { ...account, password: "123" })).toBe("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  });

  test("bad email is rejected", () => {
    expect(firstError(staffAccountSchema, { ...account, email: "nope" })).toBe("อีเมลไม่ถูกต้อง");
  });
});
