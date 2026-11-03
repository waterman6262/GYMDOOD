import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const text = z.string().trim().default("");

export const shopSettingsSchema = z.object({
  gym_name: text,
  address: text,
  phone: text,
  // Empty until the owner sets it; otherwise a 10-digit mobile or 13-digit ID.
  promptpay_id: z
    .string()
    .default("")
    .transform(normalizePhone)
    .refine((v) => v === "" || /^0\d{9}$/.test(v) || /^\d{13}$/.test(v), {
      error: "เลข PromptPay ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก",
    }),
  receipt_footer: text,
});

export const staffAccountSchema = z.object({
  name: z.string().trim().min(1, { error: "กรุณากรอกชื่อ" }),
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "อีเมลไม่ถูกต้อง" })),
  password: z.string().min(8, { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }),
  role: z.enum(["owner", "staff"], { error: "กรุณาเลือกบทบาท" }),
});

export type ShopSettings = z.output<typeof shopSettingsSchema>;
export type StaffAccountInput = z.input<typeof staffAccountSchema>;
