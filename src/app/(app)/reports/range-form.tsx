import Link from "next/link";
import { addDays } from "@/lib/classes/time";
import { monthStartOf } from "@/lib/reports/range";

/** Date range picker for owner reports. A plain GET form: the URL holds the state. */
export function RangeForm({ tab, from, to, today }: { tab: string; from: string; to: string; today: string }) {
  const monthStart = monthStartOf(today);
  const lastMonthEnd = addDays(monthStart, -1);
  const shortcuts = [
    { label: "วันนี้", from: today, to: today },
    { label: "7 วันล่าสุด", from: addDays(today, -6), to: today },
    { label: "เดือนนี้", from: monthStart, to: today },
    { label: "เดือนก่อน", from: monthStartOf(lastMonthEnd), to: lastMonthEnd },
  ];

  return (
    <div className="card space-y-3">
      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={tab} />
        <label className="block">
          <span className="field-label">วันที่เริ่ม</span>
          <input type="date" name="from" defaultValue={from} className="input" />
        </label>
        <label className="block">
          <span className="field-label">วันที่สิ้นสุด</span>
          <input type="date" name="to" defaultValue={to} className="input" />
        </label>
        <button type="submit" className="btn-primary">
          ดูรายงาน
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((s) => (
          <Link
            key={s.label}
            href={`/reports?tab=${tab}&from=${s.from}&to=${s.to}`}
            className={from === s.from && to === s.to ? "btn-primary" : "btn"}
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
