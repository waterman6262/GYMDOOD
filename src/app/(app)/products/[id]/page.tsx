import Link from "next/link";
import { notFound } from "next/navigation";
import { formatThaiDateTime } from "@/lib/sales/format";
import { createClient } from "@/lib/supabase/server";

const REASON_LABELS: Record<string, string> = {
  sale: "ขาย",
  receive: "รับเข้า",
  adjust: "ปรับยอด",
  void: "คืนจากยกเลิกบิล",
};

type Movement = {
  id: string;
  change: number;
  reason: string;
  note: string | null;
  created_at: string;
  staff: { name: string } | null;
  sales: { id: string; receipt_no: string } | null;
};

export default async function ProductHistoryPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: product }, { data }] = await Promise.all([
    supabase.from("products").select("name, track_stock, stock_qty").eq("id", id).maybeSingle(),
    supabase
      .from("stock_movements")
      .select("id, change, reason, note, created_at, staff(name), sales(id, receipt_no)")
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (!product) notFound();
  const movements = (data ?? []) as unknown as Movement[];

  return (
    <div className="space-y-6">
      <Link href="/products" className="text-sm text-indigo-700 hover:underline">
        ← กลับไปรายการสินค้า
      </Link>
      <h1 className="text-2xl font-bold">{product.name}</h1>
      <p className="text-slate-600">
        {product.track_stock ? `คงเหลือ ${product.stock_qty}` : "ไม่นับสต็อก"} · ประวัติ 100 รายการล่าสุด
      </p>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table data-testid="stock-history" className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">เวลา</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3 text-right">จำนวน</th>
              <th className="px-4 py-3">หมายเหตุ</th>
              <th className="px-4 py-3">ผู้ทำ</th>
              <th className="px-4 py-3">ใบเสร็จ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2">{formatThaiDateTime(m.created_at)}</td>
                <td className="px-4 py-2">{REASON_LABELS[m.reason] ?? m.reason}</td>
                <td className={`px-4 py-2 text-right font-semibold ${m.change > 0 ? "text-green-700" : "text-red-700"}`}>
                  {m.change > 0 ? `+${m.change}` : m.change}
                </td>
                <td className="px-4 py-2">{m.note}</td>
                <td className="px-4 py-2">{m.staff?.name}</td>
                <td className="px-4 py-2">
                  {m.sales && (
                    <Link href={`/sales/${m.sales.id}`} className="font-mono text-indigo-700 hover:underline">
                      {m.sales.receipt_no}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-slate-400">
                  ยังไม่มีประวัติ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
