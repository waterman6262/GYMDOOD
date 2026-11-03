export type PackageLine = {
  kind: "package";
  key: string;
  packageTypeId: string;
  name: string;
  price: number;
  seats: 1 | 2;
  /** First entry is the buyer; a couple package needs a second member. */
  memberIds: string[];
};

export type ProductLine = {
  kind: "product";
  key: string;
  productId: string;
  name: string;
  price: number;
  qty: number;
  trackStock: boolean;
  /** Stock when the sell screen loaded; the database checks again on save. */
  stock: number;
};

export type CartLine = PackageLine | ProductLine;

export type Discount = { type: "amount" | "percent"; value: number };

export type SellableProduct = { id: string; name: string; price: number; track_stock: boolean; stock_qty: number };

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const lineTotal = (line: CartLine) => (line.kind === "product" ? line.price * line.qty : line.price);

/** Display totals. The database recomputes these from its own prices on save. */
export function computeTotals(lines: CartLine[], discount: Discount) {
  const subtotal = round2(lines.reduce((sum, line) => sum + lineTotal(line), 0));
  const value = Number.isFinite(discount.value) ? discount.value : 0;
  const raw = discount.type === "percent" ? (subtotal * clamp(value, 0, 100)) / 100 : value;
  const discountAmount = round2(clamp(raw, 0, subtotal));
  return { subtotal, discountAmount, total: round2(subtotal - discountAmount) };
}

/** First problem that would stop the sale, worded like create_sale's errors. */
export function cartError(lines: CartLine[], buyerId: string | null): string | null {
  if (lines.length === 0) return "ตะกร้าว่าง";
  if (!buyerId && lines.some((l) => l.kind === "package")) return "กรุณาเลือกสมาชิก";

  for (const line of lines) {
    if (line.kind === "package") {
      const filled = line.memberIds.filter(Boolean);
      if (filled.length !== line.seats || new Set(filled).size !== line.seats) {
        return `แพ็กเกจ "${line.name}" ต้องเลือกสมาชิก ${line.seats} คนไม่ซ้ำกัน`;
      }
    } else if (!Number.isInteger(line.qty) || line.qty < 1) {
      return "จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 1";
    }
  }

  const wanted = new Map<string, { line: ProductLine; qty: number }>();
  for (const line of lines) {
    if (line.kind !== "product" || !line.trackStock) continue;
    const entry = wanted.get(line.productId) ?? { line, qty: 0 };
    entry.qty += line.qty;
    wanted.set(line.productId, entry);
  }
  for (const { line, qty } of wanted.values()) {
    if (qty > line.stock) return `สินค้า "${line.name}" เหลือไม่พอ (เหลือ ${line.stock})`;
  }
  return null;
}

/** Shape create_sale expects. Prices are deliberately left out. */
export function toSaleItems(lines: CartLine[]) {
  return lines.map((line) =>
    line.kind === "package"
      ? { package_type_id: line.packageTypeId, member_ids: line.memberIds }
      : { product_id: line.productId, qty: line.qty },
  );
}

/** Adds one of a product, growing its existing line instead of adding a new one. */
export function addProduct(lines: CartLine[], product: SellableProduct): CartLine[] {
  const existing = lines.find((l) => l.kind === "product" && l.productId === product.id);
  if (existing) {
    return lines.map((l) => (l === existing && l.kind === "product" ? { ...l, qty: l.qty + 1 } : l));
  }
  return [
    ...lines,
    {
      kind: "product",
      key: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      qty: 1,
      trackStock: product.track_stock,
      stock: product.stock_qty,
    },
  ];
}
