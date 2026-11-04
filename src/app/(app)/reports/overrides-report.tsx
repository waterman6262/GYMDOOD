import type { OverrideRow } from "@/lib/reports/types";
import { formatThaiDateTime } from "@/lib/sales/format";

export function OverridesReportView({ rows }: { rows: OverrideRow[] }) {
  if (rows.length === 0) return <p className="text-slate-500">ไม่มีการปล่อยเข้าในช่วงนี้</p>;

  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3">เวลา</th>
            <th className="px-4 py-3">สมาชิก</th>
            <th className="px-4 py-3">เหตุผล</th>
            <th className="px-4 py-3">พนักงาน</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-4 py-2">{formatThaiDateTime(r.checked_in_at)}</td>
              <td className="px-4 py-2">{r.member_name}</td>
              <td className="px-4 py-2">{r.reason}</td>
              <td className="px-4 py-2">{r.staff_name ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
