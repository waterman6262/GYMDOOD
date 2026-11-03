import Link from "next/link";
import { getCurrentStaff } from "@/lib/auth";
import { baht, PAYMENT_LABELS, type PaymentMethod } from "@/lib/sales/format";
import { createClient } from "@/lib/supabase/server";

type SaleRow = {
  id: string;
  receipt_no: string;
  created_at: string;
  total: number;
  payment_method: PaymentMethod;
  status: "paid" | "voided";
  members: { name: string } | null;
};

const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  const staff = await getCurrentStaff();
  const isOwner = staff?.role === "owner";
  const params = await searchParams;
  // Staff only see today's bills (spec §7); the owner can pick any day.
  const requested = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;
  const date = isOwner && requested ? requested : bangkokToday();

  const supabase = await createClient();
  const { data } = await supabase
    .from("sales")
    .select("id, receipt_no, created_at, total, payment_method, status, members(name)")
    .gte("created_at", `${date}T00:00:00+07:00`)
    .lt("created_at", `${date}T24:00:00+07:00`)
    .order("created_at", { ascending: false });
  const sales = (data ?? []) as unknown as SaleRow[];
  const paidTotal = sales.filter((s) => s.status === "paid").reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">รายการบิล</h1>
        {isOwner && (
          <form className="flex items-end gap-2">
            <label className="block">
              <span className="field-label">วันที่</span>
              <input type="date" name="date" defaultValue={date} className="input" />
            </label>
            <button type="submit" className="btn">
              ดู
            </button>
          </form>
        )}
      </div>
      <p className="text-slate-600">
        {sales.length} บิล · ยอดขายสุทธิ <span className="font-semibold text-slate-900">{baht(paidTotal)}</span> บาท
      </p>
      {sales.length === 0 ? (
        <p className="text-slate-500">ยังไม่มีบิล</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3">เลขที่</th>
                <th className="px-4 py-3">เวลา</th>
                <th className="px-4 py-3">สมาชิก</th>
                <th className="px-4 py-3">ชำระโดย</th>
                <th className="px-4 py-3 text-right">สุทธิ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sales.map((s) => (
                <tr key={s.id} className={s.status === "voided" ? "text-slate-400 line-through" : ""}>
                  <td className="px-4 py-3">
                    <Link href={`/sales/${s.id}`} className="font-mono text-indigo-700 hover:underline">
                      {s.receipt_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{timeFormat.format(new Date(s.created_at))}</td>
                  <td className="px-4 py-3">{s.members?.name ?? "-"}</td>
                  <td className="px-4 py-3">{PAYMENT_LABELS[s.payment_method]}</td>
                  <td className="px-4 py-3 text-right">{baht(s.total)}</td>
                  <td className="px-4 py-3 text-sm no-underline">{s.status === "voided" && "ยกเลิก"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
