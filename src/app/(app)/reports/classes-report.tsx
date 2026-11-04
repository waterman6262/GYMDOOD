import Link from "next/link";
import { bangkokDateOf, formatTime } from "@/lib/classes/time";
import type { ClassesReport } from "@/lib/reports/types";
import { formatThaiDate } from "@/lib/sales/format";
import { Bars, Stat } from "./bars";

export function ClassesReportView({ data }: { data: ClassesReport }) {
  const held = data.sessions.filter((s) => !s.cancelled);
  const attended = held.reduce((sum, s) => sum + s.attended, 0);
  const noShow = held.reduce((sum, s) => sum + s.no_show, 0);
  const rate = attended + noShow > 0 ? `${Math.round((attended / (attended + noShow)) * 100)}%` : "-";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="รอบคลาส" value={held.length} />
        <Stat label="คนเข้าคลาส" value={attended} />
        <Stat label="อัตราการมา" value={rate} />
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">รอบคลาส</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="py-2">วันเวลา</th>
                <th className="py-2">คลาส</th>
                <th className="py-2">เทรนเนอร์</th>
                <th className="py-2 text-right">จอง/ที่นั่ง</th>
                <th className="py-2 text-right">มา</th>
                <th className="py-2 text-right">ไม่มา</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.sessions.map((s) => (
                <tr key={s.id} className={s.cancelled ? "text-slate-400" : ""}>
                  <td className="py-2">
                    <Link href={`/classes/${s.id}`} className="text-indigo-700 hover:underline">
                      {formatThaiDate(bangkokDateOf(s.starts_at))} {formatTime(s.starts_at)}
                    </Link>
                    {s.cancelled && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">ยกเลิก</span>}
                  </td>
                  <td className="py-2">{s.class_name}</td>
                  <td className="py-2">{s.trainer_name ?? "-"}</td>
                  <td className="py-2 text-right tabular-nums">
                    {s.booked}/{s.capacity}
                  </td>
                  <td className="py-2 text-right tabular-nums">{s.attended}</td>
                  <td className="py-2 text-right tabular-nums">{s.no_show}</td>
                </tr>
              ))}
              {data.sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-2 text-slate-400">
                    ไม่มีคลาสในช่วงนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">ชั่วโมง PT แยกตามเทรนเนอร์</h2>
        {data.pt_by_trainer.length === 0 ? (
          <p className="text-slate-400">ยังไม่มีชั่วโมง PT ที่เทรนแล้วในช่วงนี้</p>
        ) : (
          <Bars rows={data.pt_by_trainer.map((t) => ({ label: t.trainer_name, value: t.done, display: `${t.done} ชม.` }))} />
        )}
      </section>
    </div>
  );
}
