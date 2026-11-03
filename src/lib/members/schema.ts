import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const memberSchema = z.object({
  name: z.string({ error: "กรุณากรอกชื่อ" }).trim().min(1, { error: "กรุณากรอกชื่อ" }),
  phone: z
    .string()
    .optional()
    .transform((v) => (v ? normalizePhone(v) : undefined))
    .refine((v) => v === undefined || /^0\d{8,9}$/.test(v), {
      error: "เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0",
    }),
  line_id: optionalText,
  note: optionalText,
});

export type MemberInput = z.input<typeof memberSchema>;
export type MemberData = z.output<typeof memberSchema>;
