import Link from "next/link";
import type { SalesReport } from "@/lib/reports/types";
import { baht, formatThaiDate, PAYMENT_LABELS } from "@/lib/sales/format";
import { Bars, Stat } from "./bars";

export function SalesReportView({ data, from, to }: { data: SalesReport; from: string; to: string }) {
  const singleDay = from === to;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="จำนวนบิล" value={data.totals.bills} />
        <Stat label="ยอดก่อนส่วนลด" value={baht(data.totals.subtotal)} />
        <Stat label="ส่วนลด" value={baht(data.totals.discount)} />
        <Stat label="ยอดสุทธิ" value={baht(data.totals.net)} testId="sales-net" />
        <Stat label="บิลที่ยกเลิก" value={data.totals.voided_bills} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-semibold">แยกตามวิธีชำระ</h2>
          <Bars
            rows={data.by_payment.map((p) => ({
              label: PAYMENT_LABELS[p.method],
              value: Number(p.net),
              display: `${baht(p.net)} (${p.bills})`,
            }))}
          />
        </section>
        <section className="card space-y-3">
          <h2 className="font-semibold">แยกตามประเภท (ก่อนส่วนลด)</h2>
          <Bars
            rows={[
              { label: "แพ็กเกจ", value: Number(data.by_type.package), display: baht(data.by_type.package) },
              { label: "สินค้า", value: Number(data.by_type.product), display: baht(data.by_type.product) },
            ]}
          />
        </section>
      </div>

      {!singleDay && (
        <section className="card space-y-3">
          <h2 className="font-semibold">รายวัน</h2>
          <Bars
            rows={data.by_day.map((d) => ({
              label: formatThaiDate(d.day),
              value: Number(d.net),
              display: baht(d.net),
            }))}
          />
        </section>
      )}

      {singleDay && (
        <Link href={`/sales?date=${from}`} className="btn">
          ดูรายการบิล
        </Link>
      )}
    </div>
  );
}
