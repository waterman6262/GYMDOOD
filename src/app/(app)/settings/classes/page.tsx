import { requireOwnerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setClassTypeActive } from "./actions";
import { ClassTypeForm } from "./class-type-form";

export default async function ClassTypesSettingsPage() {
  await requireOwnerPage();
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_types")
    .select("id, name, default_capacity, active")
    .order("active", { ascending: false })
    .order("name");

  return (
    <div className="space-y-6">
      <ClassTypeForm />
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3">ชื่อคลาส</th>
              <th className="px-4 py-3">จำนวนที่นั่ง</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {(data ?? []).map((t) => (
              <tr key={t.id} className={t.active ? "" : "text-slate-400"}>
                <td className="px-4 py-3">
                  {t.name}
                  {!t.active && <span className="ml-2 text-xs">(ปิดใช้งาน)</span>}
                </td>
                <td className="px-4 py-3">{t.default_capacity}</td>
                <td className="px-4 py-2 text-right">
                  <form action={setClassTypeActive.bind(null, t.id, !t.active)}>
                    <button type="submit" className="btn">
                      {t.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
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
