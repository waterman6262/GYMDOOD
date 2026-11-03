import { requireOwnerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setTrainerActive } from "./actions";
import { TrainerForm } from "./trainer-form";

export default async function TrainersSettingsPage() {
  await requireOwnerPage();
  const supabase = await createClient();
  const { data } = await supabase
    .from("trainers")
    .select("id, name, phone, active")
    .order("active", { ascending: false })
    .order("name");

  return (
    <div className="space-y-6">
      <TrainerForm />
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3">ชื่อ</th>
              <th className="px-4 py-3">เบอร์โทร</th>
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
                <td className="px-4 py-3">{t.phone}</td>
                <td className="px-4 py-2 text-right">
                  <form action={setTrainerActive.bind(null, t.id, !t.active)}>
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
