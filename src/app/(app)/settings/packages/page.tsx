import Link from "next/link";
import { requireOwnerPage } from "@/lib/auth";
import { PACKAGE_KIND_LABELS } from "@/lib/packages/schema";
import { createClient } from "@/lib/supabase/server";
import { setPackageTypeActive } from "./actions";
import { PackageForm, type PackageTypeRow } from "./package-form";

const baht = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

function describe(p: PackageTypeRow) {
  switch (p.kind) {
    case "day":
      return "ใช้ได้ 1 วัน";
    case "duration":
      return `${p.duration_days} วัน`;
    case "visits":
      return `${p.visits} ครั้ง / ${p.duration_days} วัน`;
    case "pt":
      return `${p.pt_sessions} ชั่วโมง / ${p.duration_days} วัน`;
  }
}

export default async function PackagesSettingsPage({ searchParams }: PageProps<"/settings/packages">) {
  await requireOwnerPage();
  const { edit } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("package_types")
    .select("id, name, kind, price, duration_days, visits, pt_sessions, seats, tag, active")
    .order("active", { ascending: false })
    .order("kind")
    .order("price");
  const packages = (data ?? []) as PackageTypeRow[];
  const editing = packages.find((p) => p.id === edit);

  return (
    <div className="space-y-6">
      <PackageForm key={editing?.id ?? "new"} editing={editing} />
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3">ชื่อ</th>
              <th className="px-4 py-3">ชนิด</th>
              <th className="px-4 py-3">รายละเอียด</th>
              <th className="px-4 py-3 text-right">ราคา</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {packages.map((p) => (
              <tr key={p.id} className={p.active ? "" : "text-slate-400"}>
                <td className="px-4 py-3">
                  {p.name}
                  {p.tag && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{p.tag}</span>}
                  {p.seats === 2 && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-800">2 คน</span>}
                  {!p.active && <span className="ml-2 text-xs">(ปิดขาย)</span>}
                </td>
                <td className="px-4 py-3">{PACKAGE_KIND_LABELS[p.kind]}</td>
                <td className="px-4 py-3">{describe(p)}</td>
                <td className="px-4 py-3 text-right">{baht.format(p.price)}</td>
                <td className="flex justify-end gap-2 px-4 py-2">
                  <Link href={`/settings/packages?edit=${p.id}`} className="btn">
                    แก้ไข
                  </Link>
                  <form action={setPackageTypeActive.bind(null, p.id, !p.active)}>
                    <button type="submit" className="btn">
                      {p.active ? "ปิดขาย" : "เปิดขาย"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
