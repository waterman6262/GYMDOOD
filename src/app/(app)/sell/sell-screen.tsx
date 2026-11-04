"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PACKAGE_KIND_LABELS, type PackageKind } from "@/lib/packages/schema";
import {
  addProduct,
  cartError,
  computeTotals,
  toSaleItems,
  type CartLine,
  type Discount,
  type SellableProduct,
} from "@/lib/sales/cart";
import { baht, PAYMENT_LABELS, type PaymentMethod } from "@/lib/sales/format";
import { useOnline } from "@/components/online-status";
import { submitSale, type MemberHit } from "./actions";
import { MemberPicker } from "./member-picker";
import { PromptPayQr } from "./promptpay-qr";

export type SellPackage = { id: string; name: string; kind: PackageKind; price: number; seats: 1 | 2; tag: string | null };
type Buyer = Pick<MemberHit, "id" | "name" | "member_code">;

type Props = { packages: SellPackage[]; products: SellableProduct[]; promptpayId: string; initialBuyer: Buyer | null };

export function SellScreen({ packages, products, promptpayId, initialBuyer }: Props) {
  const router = useRouter();
  const online = useOnline();
  const [buyer, setBuyer] = useState<Buyer | null>(initialBuyer);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [secondNames, setSecondNames] = useState<Record<string, string>>({});
  const [discount, setDiscount] = useState<Discount>({ type: "amount", value: 0 });
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // One id per cart contents: a retried or double-tapped submit of the same
  // cart returns the same sale; any change to the cart starts a new request.
  const requestId = useRef<string>(crypto.randomUUID());
  const submitting = useRef(false);
  useEffect(() => {
    requestId.current = crypto.randomUUID();
  }, [buyer, lines, discount, payment]);

  const totals = computeTotals(lines, discount);
  const promptpayMissing = payment === "promptpay" && !promptpayId;

  function chooseBuyer(member: Buyer) {
    setBuyer(member);
    // Package lines belong to the previous buyer; products can stay.
    setLines((prev) => prev.filter((l) => l.kind === "product"));
    setSecondNames({});
    setError(null);
  }

  function addLine(pkg: SellPackage) {
    if (!buyer) return;
    setLines((prev) => [
      ...prev,
      { kind: "package", key: crypto.randomUUID(), packageTypeId: pkg.id, name: pkg.name, price: Number(pkg.price), seats: pkg.seats, memberIds: [buyer.id] },
    ]);
    setError(null);
  }

  function changeQty(key: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key && l.kind === "product" ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.kind !== "product" || l.qty > 0),
    );
    setError(null);
  }

  function setSecondMember(key: string, member: MemberHit) {
    setLines((prev) =>
      prev.map((l) => (l.key === key && l.kind === "package" ? { ...l, memberIds: [l.memberIds[0], member.id] } : l)),
    );
    setSecondNames((prev) => ({ ...prev, [key]: member.name }));
    setError(null);
  }

  async function checkout() {
    if (submitting.current) return;
    // Check against the latest stock counts (refreshed after each failed sale).
    const stock = new Map(products.map((p) => [p.id, p.stock_qty]));
    const current = lines.map((l) => (l.kind === "product" ? { ...l, stock: stock.get(l.productId) ?? 0 } : l));
    const problem = cartError(current, buyer?.id ?? null);
    if (problem) return setError(problem);
    if (!payment) return setError("กรุณาเลือกวิธีชำระเงิน");

    submitting.current = true;
    setPending(true);
    setError(null);
    // A request that never comes back (Wi-Fi up, internet down) rejects instead
    // of returning an error. The cart and request id are kept, so pressing pay
    // again returns the same sale if the first attempt did reach the server.
    const result = await submitSale({
      clientRequestId: requestId.current,
      memberId: buyer?.id ?? null,
      items: toSaleItems(lines),
      discount: totals.discountAmount,
      paymentMethod: payment,
    }).catch(() => ({ error: "บันทึกไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่" }));
    if ("error" in result) {
      submitting.current = false;
      setPending(false);
      setError(result.error);
      // Stock may have changed on another tablet; reload the counts.
      router.refresh();
      return;
    }
    router.push(`/sales/${result.saleId}`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <section className="space-y-6">
        <div className="card space-y-3">
          <h2 className="font-semibold">ผู้ซื้อ</h2>
          <MemberPicker label="ค้นหาผู้ซื้อ" onPick={chooseBuyer} />
        </div>
        <div className="card space-y-3">
          <h2 className="font-semibold">แพ็กเกจ</h2>
          {!buyer && <p className="text-sm text-slate-500">เลือกสมาชิกก่อน</p>}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                aria-label={`เพิ่ม ${pkg.name}`}
                disabled={!buyer}
                onClick={() => addLine(pkg)}
                className="flex min-h-20 flex-col items-start justify-between rounded-xl p-3 text-left ring-1 ring-slate-200 hover:bg-indigo-50 hover:ring-indigo-300 disabled:opacity-40"
              >
                <span className="font-medium">{pkg.name}</span>
                <span className="flex w-full items-end justify-between gap-2 text-sm text-slate-500">
                  <span>
                    {PACKAGE_KIND_LABELS[pkg.kind]}
                    {pkg.seats === 2 && " · 2 คน"}
                  </span>
                  <span className="font-semibold text-slate-900">{baht(pkg.price)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="card space-y-3">
          <h2 className="font-semibold">สินค้า</h2>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {products.map((p) => {
              const soldOut = p.track_stock && p.stock_qty <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`เพิ่ม ${p.name}`}
                  disabled={soldOut}
                  onClick={() => {
                    setLines((prev) => addProduct(prev, p));
                    setError(null);
                  }}
                  className="flex min-h-16 flex-col items-start justify-between rounded-xl p-3 text-left ring-1 ring-slate-200 hover:bg-emerald-50 hover:ring-emerald-300 disabled:opacity-40"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="flex w-full items-end justify-between gap-2 text-sm text-slate-500">
                    <span>{p.track_stock ? (soldOut ? "หมด" : `เหลือ ${p.stock_qty} ชิ้น`) : ""}</span>
                    <span className="font-semibold text-slate-900">{baht(p.price)}</span>
                  </span>
                </button>
              );
            })}
            {products.length === 0 && <p className="text-sm text-slate-500">ยังไม่มีสินค้า</p>}
          </div>
        </div>
      </section>

      <aside className="card h-fit space-y-4 lg:sticky lg:top-4">
        <div data-testid="buyer" className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">ผู้ซื้อ</p>
          {buyer ? (
            <p className="font-semibold">
              {buyer.name} <span className="font-mono text-sm text-slate-500">{buyer.member_code}</span>
            </p>
          ) : (
            <p className="text-slate-400">ยังไม่ได้เลือก</p>
          )}
        </div>

        <ul data-testid="cart" className="space-y-3">
          {lines.map((line) => (
            <li key={line.key} className="space-y-2 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between gap-2">
                <span>
                  {line.name}
                  {line.kind === "product" && <span className="text-slate-500"> × {line.qty}</span>}
                </span>
                <span className="flex items-center gap-2">
                  {line.kind === "product" && (
                    <>
                      <button
                        type="button"
                        aria-label={`ลด ${line.name}`}
                        onClick={() => changeQty(line.key, -1)}
                        className="size-9 rounded-lg ring-1 ring-slate-300"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        aria-label={`เพิ่มจำนวน ${line.name}`}
                        onClick={() => changeQty(line.key, 1)}
                        className="size-9 rounded-lg ring-1 ring-slate-300"
                      >
                        +
                      </button>
                    </>
                  )}
                  {baht(line.kind === "product" ? line.price * line.qty : line.price)}
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    className="text-sm text-red-600 hover:underline"
                  >
                    ลบ
                  </button>
                </span>
              </div>
              {line.kind === "package" && line.seats === 2 &&
                (secondNames[line.key] ? (
                  <p className="text-sm text-slate-600">สมาชิกคนที่ 2: {secondNames[line.key]}</p>
                ) : (
                  <MemberPicker label="ค้นหาสมาชิกคนที่ 2" onPick={(m) => setSecondMember(line.key, m)} />
                ))}
            </li>
          ))}
          {lines.length === 0 && <li className="text-sm text-slate-400">ตะกร้าว่าง</li>}
        </ul>

        <div className="flex items-end gap-2">
          <label className="block flex-1">
            <span className="field-label">ส่วนลด</span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={discount.value || ""}
              onChange={(e) => setDiscount((d) => ({ ...d, value: Number(e.target.value) }))}
              className="input"
            />
          </label>
          {(["amount", "percent"] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={discount.type === type}
              onClick={() => setDiscount((d) => ({ ...d, type }))}
              className={discount.type === type ? "btn-primary" : "btn"}
            >
              {type === "amount" ? "บาท" : "%"}
            </button>
          ))}
        </div>

        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>ยอดรวม</dt>
            <dd>{baht(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>ส่วนลด</dt>
            <dd>{baht(totals.discountAmount)}</dd>
          </div>
          <div className="flex justify-between text-xl font-bold">
            <dt>สุทธิ</dt>
            <dd data-testid="net-total">{baht(totals.total)}</dd>
          </div>
        </dl>

        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              aria-pressed={payment === method}
              onClick={() => setPayment(method)}
              className={payment === method ? "btn-primary" : "btn"}
            >
              {PAYMENT_LABELS[method]}
            </button>
          ))}
        </div>

        {payment === "promptpay" &&
          (promptpayMissing ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              ยังไม่ได้ตั้งเลข PromptPay (ตั้งได้ที่ ตั้งค่า → ข้อมูลร้าน)
            </p>
          ) : (
            lines.length > 0 && <PromptPayQr promptpayId={promptpayId} amount={totals.total} />
          ))}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={checkout}
          disabled={pending || promptpayMissing || !online}
          className="btn-primary w-full text-lg"
        >
          {pending ? "กำลังบันทึก…" : payment === "promptpay" ? "ได้รับเงินแล้ว" : "ชำระเงิน"}
        </button>
      </aside>
    </div>
  );
}
