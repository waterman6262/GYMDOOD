"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PACKAGE_KIND_LABELS, type PackageKind } from "@/lib/packages/schema";
import { cartError, computeTotals, toSaleItems, type CartLine, type Discount } from "@/lib/sales/cart";
import { baht, PAYMENT_LABELS, type PaymentMethod } from "@/lib/sales/format";
import { submitSale, type MemberHit } from "./actions";
import { MemberPicker } from "./member-picker";
import { PromptPayQr } from "./promptpay-qr";

export type SellPackage = { id: string; name: string; kind: PackageKind; price: number; seats: 1 | 2; tag: string | null };
type Buyer = Pick<MemberHit, "id" | "name" | "member_code">;

type Props = { packages: SellPackage[]; promptpayId: string; initialBuyer: Buyer | null };

export function SellScreen({ packages, promptpayId, initialBuyer }: Props) {
  const router = useRouter();
  const [buyer, setBuyer] = useState<Buyer | null>(initialBuyer);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [secondNames, setSecondNames] = useState<Record<string, string>>({});
  const [discount, setDiscount] = useState<Discount>({ type: "amount", value: 0 });
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // One id per cart: a retried or double-tapped submit returns the same sale.
  const requestId = useRef<string>(crypto.randomUUID());
  const submitting = useRef(false);

  const totals = computeTotals(lines, discount);
  const promptpayMissing = payment === "promptpay" && !promptpayId;

  function chooseBuyer(member: Buyer) {
    setBuyer(member);
    setLines([]);
    setSecondNames({});
    setError(null);
  }

  function addLine(pkg: SellPackage) {
    if (!buyer) return;
    setLines((prev) => [
      ...prev,
      { key: crypto.randomUUID(), packageTypeId: pkg.id, name: pkg.name, price: Number(pkg.price), seats: pkg.seats, memberIds: [buyer.id] },
    ]);
    setError(null);
  }

  function setSecondMember(key: string, member: MemberHit) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, memberIds: [l.memberIds[0], member.id] } : l)));
    setSecondNames((prev) => ({ ...prev, [key]: member.name }));
    setError(null);
  }

  async function checkout() {
    if (submitting.current) return;
    if (!buyer) return setError("กรุณาเลือกสมาชิก");
    const problem = cartError(lines);
    if (problem) return setError(problem);
    if (!payment) return setError("กรุณาเลือกวิธีชำระเงิน");

    submitting.current = true;
    setPending(true);
    setError(null);
    const result = await submitSale({
      clientRequestId: requestId.current,
      memberId: buyer.id,
      items: toSaleItems(lines),
      discount: totals.discountAmount,
      paymentMethod: payment,
    });
    if ("error" in result) {
      submitting.current = false;
      setPending(false);
      setError(result.error);
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

        <ul className="space-y-3">
          {lines.map((line) => (
            <li key={line.key} className="space-y-2 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between gap-2">
                <span>{line.name}</span>
                <span className="flex items-center gap-2">
                  {baht(line.price)}
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    className="text-sm text-red-600 hover:underline"
                  >
                    ลบ
                  </button>
                </span>
              </div>
              {line.seats === 2 &&
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
          disabled={pending || promptpayMissing}
          className="btn-primary w-full text-lg"
        >
          {pending ? "กำลังบันทึก…" : payment === "promptpay" ? "ได้รับเงินแล้ว" : "ชำระเงิน"}
        </button>
      </aside>
    </div>
  );
}
