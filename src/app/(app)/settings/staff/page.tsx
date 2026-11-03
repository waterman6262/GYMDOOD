import { requireOwnerPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NewStaffForm, StaffActiveButton } from "./staff-forms";

type StaffRow = { id: string; user_id: string; name: string; role: "owner" | "staff"; active: boolean };

export default async function StaffSettingsPage() {
  await requireOwnerPage();
  const supabase = await createClient();
  const { data } = await supabase.from("staff").select("id, user_id, name, role, active").order("created_at");
  const staff = (data ?? []) as StaffRow[];

  // Emails live in Supabase Auth, which only the service role can list.
  const { data: users } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(users.users.map((u) => [u.id, u.email ?? ""]));

  return (
    <div className="space-y-6">
      <NewStaffForm />
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3">ชื่อ</th>
              <th className="px-4 py-3">อีเมล</th>
              <th className="px-4 py-3">บทบาท</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {staff.map((s) => (
              <tr key={s.id} className={s.active ? "" : "text-slate-400"}>
                <td className="px-4 py-3">
                  {s.name}
                  {!s.active && <span className="ml-2 text-xs">(ปิดบัญชี)</span>}
                </td>
                <td className="px-4 py-3">{emailById.get(s.user_id)}</td>
                <td className="px-4 py-3">{s.role === "owner" ? "เจ้าของ" : "พนักงาน"}</td>
                <td className="px-4 py-2">
                  <StaffActiveButton staffId={s.id} active={s.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
