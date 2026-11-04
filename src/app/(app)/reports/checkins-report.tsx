import type { CheckinsReport } from "@/lib/reports/types";
import { formatThaiDate } from "@/lib/sales/format";
import { Bars, Stat } from "./bars";

export function CheckinsReportView({ data, singleDay }: { data: CheckinsReport; singleDay: boolean }) {
  // Trim empty hours at both ends so the busy part of the day is readable.
  const busy = data.by_hour.filter((h) => h.total > 0).map((h) => h.hour);
  const hours = busy.length ? data.by_hour.filter((h) => h.hour >= Math.min(...busy) && h.hour <= Math.max(...busy)) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="เช็กอินทั้งหมด" value={data.total} testId="checkins-total" />
        <Stat label="สมาชิกไม่ซ้ำ" value={data.unique_members} />
      </div>
      <section className="card space-y-3">
        <h2 className="font-semibold">ช่วงเวลาที่คนเข้าเยอะ</h2>
        {hours.length === 0 ? (
          <p className="text-slate-400">ยังไม่มีการเช็กอินในช่วงนี้</p>
        ) : (
          <Bars rows={hours.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}:00`, value: h.total }))} />
        )}
      </section>
      {!singleDay && (
        <section className="card space-y-3">
          <h2 className="font-semibold">รายวัน</h2>
          <Bars
            rows={data.by_day.map((d) => ({
              label: formatThaiDate(d.day),
              value: d.total,
              display: `${d.total} (${d.unique_members} คน)`,
            }))}
          />
        </section>
      )}
    </div>
  );
}
