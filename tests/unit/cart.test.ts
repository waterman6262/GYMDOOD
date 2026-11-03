import { describe, expect, test } from "vitest";
import {
  addProduct,
  cartError,
  computeTotals,
  toSaleItems,
  type PackageLine,
  type ProductLine,
} from "@/lib/sales/cart";
import { baht, formatThaiDate } from "@/lib/sales/format";

const pkg = (over: Partial<PackageLine>): PackageLine => ({
  kind: "package",
  key: "p",
  packageTypeId: "p1",
  name: "รายเดือน",
  price: 1200,
  seats: 1,
  memberIds: ["a"],
  ...over,
});
const product = (over: Partial<ProductLine>): ProductLine => ({
  kind: "product",
  key: "w",
  productId: "w1",
  name: "น้ำดื่ม",
  price: 10,
  qty: 1,
  trackStock: true,
  stock: 48,
  ...over,
});

const monthly = pkg({ key: "1" });
const visits = pkg({ key: "2", packageTypeId: "p2", name: "10 ครั้ง", price: 900 });
const couple = pkg({ key: "3", packageTypeId: "p3", name: "คู่", price: 2000, seats: 2 });
const none = { type: "amount", value: 0 } as const;

describe("computeTotals", () => {
  test("subtotal_sums_lines", () => {
    expect(computeTotals([monthly, visits], none).subtotal).toBe(2100);
  });

  test("product_line_multiplies_qty", () => {
    expect(computeTotals([product({ qty: 3 }), monthly], none).subtotal).toBe(1230);
  });

  test("percent_discount", () => {
    expect(computeTotals([monthly], { type: "percent", value: 10 })).toEqual({
      subtotal: 1200,
      discountAmount: 120,
      total: 1080,
    });
  });

  test("percent_rounds_to_satang", () => {
    expect(computeTotals([pkg({ price: 999 })], { type: "percent", value: 7 }).discountAmount).toBe(69.93);
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
    expect(cartError([], null)).toBe("ตะกร้าว่าง");
  });

  test("products_only_needs_no_buyer", () => {
    expect(cartError([product({})], null)).toBeNull();
  });

  test("package_needs_buyer", () => {
    expect(cartError([monthly], null)).toBe("กรุณาเลือกสมาชิก");
  });

  test("couple_needs_two_members", () => {
    expect(cartError([couple], "a")).toBe('แพ็กเกจ "คู่" ต้องเลือกสมาชิก 2 คนไม่ซ้ำกัน');
  });

  test("couple_duplicate_member", () => {
    expect(cartError([{ ...couple, memberIds: ["a", "a"] }], "a")).toBe('แพ็กเกจ "คู่" ต้องเลือกสมาชิก 2 คนไม่ซ้ำกัน');
  });

  test("valid_cart_has_no_error", () => {
    expect(cartError([monthly, { ...couple, memberIds: ["a", "b"] }], "a")).toBeNull();
  });

  test("product_qty_must_be_whole", () => {
    expect(cartError([product({ qty: 0 })], null)).toBe("จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 1");
    expect(cartError([product({ qty: 1.5 })], null)).toBe("จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 1");
  });

  test("stock_checked_on_total_qty", () => {
    const lines = [product({ key: "a", qty: 2, stock: 3 }), product({ key: "b", qty: 2, stock: 3 })];
    expect(cartError(lines, null)).toBe('สินค้า "น้ำดื่ม" เหลือไม่พอ (เหลือ 3)');
  });

  test("untracked_ignores_stock", () => {
    expect(cartError([product({ name: "เช่าผ้าเช็ดตัว", trackStock: false, stock: 0, qty: 5 })], null)).toBeNull();
  });
});

describe("addProduct", () => {
  test("add_product_merges_line", () => {
    const water = { id: "w1", name: "น้ำดื่ม", price: 10, track_stock: true, stock_qty: 48 };
    const once = addProduct([], water);
    const twice = addProduct(once, water);
    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({ kind: "product", productId: "w1", qty: 2 });
  });
});

describe("toSaleItems", () => {
  test("to_sale_items_has_no_price", () => {
    const [item] = toSaleItems([monthly]);
    expect(item).toEqual({ package_type_id: "p1", member_ids: ["a"] });
    expect(item).not.toHaveProperty("price");
  });

  test("to_sale_items_product_shape", () => {
    expect(toSaleItems([product({ qty: 3 })])).toEqual([{ product_id: "w1", qty: 3 }]);
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
