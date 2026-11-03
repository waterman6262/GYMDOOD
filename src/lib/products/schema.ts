import { z } from "zod";

// Form values arrive as strings; an unchecked checkbox is simply missing.
export const productSchema = z.object({
  name: z.string({ error: "กรุณากรอกชื่อสินค้า" }).trim().min(1, { error: "กรุณากรอกชื่อสินค้า" }),
  price: z.coerce.number({ error: "กรุณาระบุราคา" }).min(0, { error: "ราคาต้องไม่ติดลบ" }),
  track_stock: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  low_stock_at: z.coerce
    .number({ error: "จุดเตือนต้องเป็นจำนวนเต็มไม่ติดลบ" })
    .int({ error: "จุดเตือนต้องเป็นจำนวนเต็มไม่ติดลบ" })
    .min(0, { error: "จุดเตือนต้องเป็นจำนวนเต็มไม่ติดลบ" }),
});

export type ProductData = z.output<typeof productSchema>;
