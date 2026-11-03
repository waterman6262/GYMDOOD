import { baht, formatThaiDateTime, PAYMENT_LABELS, type PaymentMethod } from "@/lib/sales/format";

/** Shape returned by the get_receipt database function. */
export type ReceiptData = {
  receipt_no: string;
  created_at: string;
  status: "paid" | "voided";
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  member_name: string | null;
  items: { name: string; qty: number; unit_price: number; line_total: number }[];
  gym: { gym_name: string; address: string; phone: string; receipt_footer: string };
};

export function Receipt({ data }: { data: ReceiptData }) {
  return (
    <article className="receipt mx-auto w-full max-w-sm space-y-3 rounded-xl bg-white p-6 font-mono text-sm shadow-sm ring-1 ring-slate-200">
      <header className="text-center">
        <p className="text-lg font-bold">{data.gym.gym_name || "ใบเสร็จรับเงิน"}</p>
        {data.gym.address && <p>{data.gym.address}</p>}
        {data.gym.phone && <p>โทร {data.gym.phone}</p>}
      </header>

      {data.status === "voided" && (
        <p className="rounded border-2 border-red-600 py-1 text-center text-base font-bold text-red-600">ยกเลิกแล้ว</p>
      )}

      <div className="border-y border-dashed border-slate-400 py-2">
        <p className="flex justify-between">
          <span>เลขที่</span>
          <span data-testid="receipt-no">{data.receipt_no}</span>
        </p>
        <p className="flex justify-between">
          <span>วันที่</span>
          <span>{formatThaiDateTime(data.created_at)}</span>
        </p>
        {data.member_name && (
          <p className="flex justify-between">
            <span>สมาชิก</span>
            <span>{data.member_name}</span>
          </p>
        )}
      </div>

      <ul className="space-y-1">
        {data.items.map((item, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>
              {item.name}
              {item.qty > 1 && ` ×${item.qty}`}
            </span>
            <span>{baht(item.line_total)}</span>
          </li>
        ))}
      </ul>

      <dl className="space-y-1 border-t border-dashed border-slate-400 pt-2">
        <div className="flex justify-between">
          <dt>ยอดรวม</dt>
          <dd>{baht(data.subtotal)}</dd>
        </div>
        {Number(data.discount) > 0 && (
          <div className="flex justify-between">
            <dt>ส่วนลด</dt>
            <dd data-testid="receipt-discount">{baht(data.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between text-base font-bold">
          <dt>สุทธิ</dt>
          <dd data-testid="receipt-total">{baht(data.total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>ชำระโดย</dt>
          <dd>{PAYMENT_LABELS[data.payment_method]}</dd>
        </div>
      </dl>

      {data.gym.receipt_footer && <p className="pt-2 text-center">{data.gym.receipt_footer}</p>}
    </article>
  );
}
