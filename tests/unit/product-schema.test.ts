import { describe, expect, test } from "vitest";
import { productSchema } from "@/lib/products/schema";

function firstError(input: unknown) {
  const result = productSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0].message;
}

const valid = { name: "น้ำดื่ม", price: "10", track_stock: "on", low_stock_at: "12" };

describe("productSchema", () => {
  test("valid_form_parses", () => {
    expect(productSchema.parse(valid)).toEqual({ name: "น้ำดื่ม", price: 10, track_stock: true, low_stock_at: 12 });
  });

  test("blank_name_rejected", () => {
    expect(firstError({ ...valid, name: " " })).toBe("กรุณากรอกชื่อสินค้า");
  });

  test("negative_price_rejected", () => {
    expect(firstError({ ...valid, price: "-1" })).toBe("ราคาต้องไม่ติดลบ");
  });

  test("fractional_low_stock_rejected", () => {
    expect(firstError({ ...valid, low_stock_at: "1.5" })).toBe("จุดเตือนต้องเป็นจำนวนเต็มไม่ติดลบ");
  });

  test("unchecked_box_means_untracked", () => {
    const { track_stock, ...rest } = valid;
    void track_stock;
    expect(productSchema.parse(rest).track_stock).toBe(false);
  });
});
