import { describe, expect, test } from "vitest";
import { cartError, computeTotals, toSaleItems, type CartLine } from "@/lib/sales/cart";
import { baht, formatThaiDate } from "@/lib/sales/format";

const monthly: CartLine = { key: "1", packageTypeId: "p1", name: "รายเดือน", price: 1200, seats: 1, memberIds: ["a"] };
const visits: CartLine = { key: "2", packageTypeId: "p2", name: "10 ครั้ง", price: 900, seats: 1, memberIds: ["a"] };
const couple: CartLine = { key: "3", packageTypeId: "p3", name: "คู่", price: 2000, seats: 2, memberIds: ["a"] };
const none = { type: "amount", value: 0 } as const;

describe("computeTotals", () => {
  test("subtotal_sums_lines", () => {
    expect(computeTotals([monthly, visits], none).subtotal).toBe(2100);
  });

  test("percent_discount", () => {
    expect(computeTotals([monthly], { type: "percent", value: 10 })).toEqual({
      subtotal: 1200,
      discountAmount: 120,
      total: 1080,
    });
  });

  test("percent_rounds_to_satang", () => {
    const line = { ...monthly, price: 999 };
    expect(computeTotals([line], { type: "percent", value: 7 }).discountAmount).toBe(69.93);
  });

  test("amount_discount_capped", () => {
    expect(computeTotals([monthly], { type: "amount", value: 5000 })).toEqual({
      subtotal: 1200,
      discountAmount: 1200,
      total: 0,
    });
  });

  test("negative_discount_is_zero", () => {
    expect(computeTotals([monthly], { type: "amount", value: -50 }).discountAmount).toBe(0);
  });
});

describe("cartError", () => {
  test("empty_cart_error", () => {
    expect(cartError([])).toBe("ตะกร้าว่าง");
  });

  test("couple_needs_two_members", () => {
    expect(cartError([couple])).toBe('แพ็กเกจ "คู่" ต้องเลือกสมาชิก 2 คนไม่ซ้ำกัน');
  });

  test("couple_duplicate_member", () => {
    expect(cartError([{ ...couple, memberIds: ["a", "a"] }])).toBe('แพ็กเกจ "คู่" ต้องเลือกสมาชิก 2 คนไม่ซ้ำกัน');
  });

  test("valid_cart_has_no_error", () => {
    expect(cartError([monthly, { ...couple, memberIds: ["a", "b"] }])).toBeNull();
  });
});

describe("toSaleItems", () => {
  test("to_sale_items_has_no_price", () => {
    const [item] = toSaleItems([monthly]);
    expect(item).toEqual({ package_type_id: "p1", member_ids: ["a"] });
    expect(item).not.toHaveProperty("price");
  });
});

describe("format", () => {
  test("baht_format", () => {
    expect(baht(1200)).toBe("1,200.00");
  });

  test("thai_date_buddhist_year", () => {
    expect(formatThaiDate("2026-11-03")).toBe("3 พ.ย. 2569");
  });
});
