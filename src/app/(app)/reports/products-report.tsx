import Link from "next/link";
import type { ProductsReport } from "@/lib/reports/types";
import { baht } from "@/lib/sales/format";

export function ProductsReportView({ data }: { data: ProductsReport }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-3">
        <h2 className="font-semibold">สินค้าขายดี</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-600">
            <tr>
              <th className="py-2">#</th>
              <th className="py-2">สินค้า</th>
              <th className="py-2 text-right">จำนวน</th>
              <th className="py-2 text-right">ยอด (ก่อนส่วนลด)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.best_sellers.map((p, i) => (
              <tr key={p.product_id}>
                <td className="py-2 text-slate-500">{i + 1}</td>
                <td className="py-2">{p.name}</td>
                <td className="py-2 text-right tabular-nums">{p.qty}</td>
                <td className="py-2 text-right tabular-nums">{baht(p.amount)}</td>
              </tr>
            ))}
            {data.best_sellers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-slate-400">
                  ยังไม่มีการขายสินค้าในช่วงนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">ของใกล้หมด</h2>
        <p className="text-sm text-slate-500">ข้อมูล ณ ตอนนี้</p>
        <ul className="divide-y divide-slate-100 text-sm">
          {data.low_stock.map((p) => (
            <li key={p.product_id} className="flex justify-between py-2">
              <Link href={`/products/${p.product_id}`} className="text-indigo-700 hover:underline">
                {p.name}
              </Link>
              <span className={p.stock_qty <= 0 ? "font-semibold text-red-700" : "text-amber-800"}>
                เหลือ {p.stock_qty} (เตือนที่ {p.low_stock_at})
              </span>
            </li>
          ))}
          {data.low_stock.length === 0 && <li className="py-2 text-slate-400">ไม่มี</li>}
        </ul>
      </section>
    </div>
  );
}
