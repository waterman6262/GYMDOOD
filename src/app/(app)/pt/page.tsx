import { bangkokDateOf, bangkokToday, bangkokToIso, formatTime } from "@/lib/classes/time";
import { getMember } from "@/lib/members/queries";
import { formatThaiDate } from "@/lib/sales/format";
import { createClient } from "@/lib/supabase/server";
import { PtActions, PtScheduler } from "./pt-forms";

type Appointment = {
  id: string;
  starts_at: string;
  completed_at: string | null;
  trainers: { name: string } | null;
  memberships: { members: { name: string } | null } | null;
};

const APPT_COLUMNS = "id, starts_at, completed_at, trainers(name), memberships(members(name))";

export default async function PtPage({ searchParams }: PageProps<"/pt">) {
  const { member: memberId } = await searchParams;
  const today = bangkokToday();
  const supabase = await createClient();

  const member = typeof memberId === "string" ? await getMember(memberId) : null;
  const [{ data: packages }, { data: trainers }, { data: upcoming }, { data: done }] = await Promise.all([
    member
      ? supabase
          .from("memberships")
          .select("id, end_date, pt_left, package_types(name)")
          .eq("member_id", member.id)
          .eq("kind", "pt")
          .eq("status", "active")
          .gte("end_date", today)
          .gt("pt_left", 0)
          .order("end_date")
      : Promise.resolve({ data: [] }),
    supabase.from("trainers").select("id, name").eq("active", true).order("name"),
    // Everything still open, including past appointments nobody closed yet.
    supabase.from("pt_appointments").select(APPT_COLUMNS).eq("status", "scheduled").order("starts_at").limit(200),
    supabase
      .from("pt_appointments")
      .select(APPT_COLUMNS)
      .eq("status", "done")
      .gte("completed_at", bangkokToIso(today, "00:00"))
      .order("completed_at", { ascending: false }),
  ]);

  const ptPackages = ((packages ?? []) as unknown as { id: string; end_date: string; pt_left: number; package_types: { name: string } | null }[]).map(
    (p) => ({ id: p.id, label: `${p.package_types?.name ?? "PT"} · เหลือ ${p.pt_left} ชั่วโมง · ถึง ${formatThaiDate(p.end_date)}` }),
  );
  const open = (upcoming ?? []) as unknown as Appointment[];
  const finished = (done ?? []) as unknown as Appointment[];
  const days = [...new Set(open.map((a) => bangkokDateOf(a.starts_at)))];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">นัด PT</h1>
      <PtScheduler
        key={member?.id ?? "none"}
        member={member?.active ? { id: member.id, name: member.name } : null}
        ptPackages={ptPackages}
        trainers={(trainers ?? []).map((t) => ({ id: t.id, label: t.name }))}
        today={today}
      />

      <section data-testid="pt-upcoming" className="card space-y-3">
        <h2 className="text-lg font-semibold">นัดที่กำลังจะถึง</h2>
        {open.length === 0 && <p className="text-slate-400">ไม่มีนัด</p>}
        {days.map((day) => (
          <div key={day} className="space-y-1">
            <h3 className={`text-sm font-semibold ${day < today ? "text-red-700" : "text-slate-600"}`}>
              {formatThaiDate(day)}
              {day < today && " (ค้างปิด)"}
              {day === today && " · วันนี้"}
            </h3>
            <ul className="divide-y divide-slate-100">
              {open
                .filter((a) => bangkokDateOf(a.starts_at) === day)
                .map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-mono">{formatTime(a.starts_at)}</span> {a.memberships?.members?.name}
                      <span className="text-slate-500"> · {a.trainers?.name}</span>
                    </span>
                    <PtActions appointmentId={a.id} />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section data-testid="pt-done" className="card space-y-2">
        <h2 className="text-lg font-semibold">เสร็จแล้ววันนี้</h2>
        <ul className="divide-y divide-slate-100">
          {finished.map((a) => (
            <li key={a.id} className="py-2">
              <span className="font-mono">{formatTime(a.completed_at ?? a.starts_at)}</span> {a.memberships?.members?.name}
              <span className="text-slate-500"> · {a.trainers?.name}</span>
            </li>
          ))}
          {finished.length === 0 && <li className="py-2 text-slate-400">ยังไม่มี</li>}
        </ul>
      </section>
    </div>
  );
}
