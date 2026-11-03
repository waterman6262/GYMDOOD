export type CartLine = {
  key: string;
  packageTypeId: string;
  name: string;
  price: number;
  seats: 1 | 2;
  /** First entry is the buyer; a couple package needs a second member. */
  memberIds: string[];
};

export type Discount = { type: "amount" | "percent"; value: number };

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** Display totals. The database recomputes these from its own prices on save. */
export function computeTotals(lines: CartLine[], discount: Discount) {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.price, 0));
  const value = Number.isFinite(discount.value) ? discount.value : 0;
  const raw = discount.type === "percent" ? (subtotal * clamp(value, 0, 100)) / 100 : value;
  const discountAmount = round2(clamp(raw, 0, subtotal));
  return { subtotal, discountAmount, total: round2(subtotal - discountAmount) };
}

/** First problem that would stop the sale, worded like create_sale's errors. */
export function cartError(lines: CartLine[]): string | null {
  if (lines.length === 0) return "ตะกร้าว่าง";
  for (const line of lines) {
    const filled = line.memberIds.filter(Boolean);
    if (filled.length !== line.seats || new Set(filled).size !== line.seats) {
      return `แพ็กเกจ "${line.name}" ต้องเลือกสมาชิก ${line.seats} คนไม่ซ้ำกัน`;
    }
  }
  return null;
}

/** Shape create_sale expects. Prices are deliberately left out. */
export function toSaleItems(lines: CartLine[]) {
  return lines.map((line) => ({ package_type_id: line.packageTypeId, member_ids: line.memberIds }));
}
