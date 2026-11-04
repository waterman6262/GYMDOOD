import Link from "next/link";
import type { MembersReport } from "@/lib/reports/types";
import { formatThaiDate } from "@/lib/sales/format";
import { Stat } from "./bars";

function Phone({ phone }: { phone: string | null }) {
  return phone ? (
    <a href={`tel:${phone}`} className="text-indigo-700 hover:underline">
      {phone}
    </a>
  ) : (
    <span className="text-slate-400">-</span>
  );
}

export function MembersReportView({ data }: { data: MembersReport }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">ข้อมูล ณ วันนี้</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="สมาชิกที่ใช้งานอยู่" value={data.active_count} />
        <Stat label="ใกล้หมดใน 7 วัน" value={data.expiring.length} />
        <Stat label="หมดอายุใน 30 วันที่ผ่านมา" value={data.expired_recent.length} />
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">ใกล้หมดใน 7 วัน</h2>
        <div className="overflow-x-auto">
          <table data-testid="expiring" className="w-full text-left text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="py-2">สมาชิก</th>
                <th className="py-2">เบอร์โทร</th>
                <th className="py-2">แพ็กเกจ</th>
                <th className="py-2">หมดอายุ</th>
                <th className="py-2">ครั้งที่เหลือ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.expiring.map((e) => (
                <tr key={e.member_id}>
                  <td className="py-2">
                    <Link href={`/members/${e.member_id}`} className="text-indigo-700 hover:underline">
                      {e.name}
                    </Link>
                  </td>
                  <td className="py-2">
                    <Phone phone={e.phone} />
                  </td>
                  <td className="py-2">{e.package_name}</td>
                  <td className="py-2">{formatThaiDate(e.end_date)}</td>
                  <td className="py-2">{e.visits_left ?? "-"}</td>
                </tr>
              ))}
              {data.expiring.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-2 text-slate-400">
                    ไม่มีสมาชิกที่ใกล้หมด
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">หมดอายุใน 30 วันที่ผ่านมา</h2>
        <div className="overflow-x-auto">
          <table data-testid="expired-recent" className="w-full text-left text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="py-2">สมาชิก</th>
                <th className="py-2">เบอร์โทร</th>
                <th className="py-2">หมดเมื่อ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.expired_recent.map((e) => (
                <tr key={e.member_id}>
                  <td className="py-2">
                    <Link href={`/members/${e.member_id}`} className="text-indigo-700 hover:underline">
                      {e.name}
                    </Link>
                  </td>
                  <td className="py-2">
                    <Phone phone={e.phone} />
                  </td>
                  <td className="py-2">{formatThaiDate(e.last_end_date)}</td>
                </tr>
              ))}
              {data.expired_recent.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-slate-400">
                    ไม่มี
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
