import Link from "next/link";
import { getCurrentStaff } from "@/lib/auth";
import { addDays, bangkokDateOf, bangkokToday, bangkokToIso, formatTime, weekStart } from "@/lib/classes/time";
import { formatThaiDate } from "@/lib/sales/format";
import { createClient } from "@/lib/supabase/server";
import { SessionForm } from "./session-form";

type SessionRow = {
  id: string;
  starts_at: string;
  capacity: number;
  cancelled: boolean;
  class_types: { name: string } | null;
  trainers: { name: string } | null;
  class_bookings: { status: string }[];
};

const WEEKDAY = new Intl.DateTimeFormat("th-TH", { weekday: "long", timeZone: "UTC" });

export default async function ClassesPage({ searchParams }: PageProps<"/classes">) {
  const [{ week }, staff] = await Promise.all([searchParams, getCurrentStaff()]);
  const isOwner = staff?.role === "owner";
  const today = bangkokToday();
  const start = weekStart(typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today);

  const supabase = await createClient();
  const [{ data }, { data: classTypes }, { data: trainers }] = await Promise.all([
    supabase
      .from("class_sessions")
      .select("id, starts_at, capacity, cancelled, class_types(name), trainers(name), class_bookings(status)")
      .gte("starts_at", bangkokToIso(start, "00:00"))
      .lt("starts_at", bangkokToIso(addDays(start, 7), "00:00"))
      .order("starts_at"),
    isOwner ? supabase.from("class_types").select("id, name").eq("active", true).order("name") : { data: [] },
    isOwner ? supabase.from("trainers").select("id, name").eq("active", true).order("name") : { data: [] },
  ]);
  const sessions = (data ?? []) as unknown as SessionRow[];
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">ตารางคลาส</h1>
        <Link href="/pt" className="btn">
          นัด PT
        </Link>
      </div>
      {isOwner && <SessionForm classTypes={classTypes ?? []} trainers={trainers ?? []} today={today} />}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/classes?week=${addDays(start, -7)}`} className="btn">
          สัปดาห์ก่อน
        </Link>
        <Link href="/classes" className="btn">
          สัปดาห์นี้
        </Link>
        <Link href={`/classes?week=${addDays(start, 7)}`} className="btn">
          สัปดาห์หน้า
        </Link>
        <span className="text-slate-600">
          {formatThaiDate(start)} – {formatThaiDate(addDays(start, 6))}
        </span>
      </div>

      <div className="space-y-4">
        {days.map((day) => {
          const list = sessions.filter((s) => bangkokDateOf(s.starts_at) === day);
          return (
            <section key={day} className={`card space-y-2 ${day === today ? "ring-2 ring-indigo-300" : ""}`}>
              <h2 className="font-semibold">
                {WEEKDAY.format(new Date(`${day}T00:00:00Z`))} {formatThaiDate(day)}
                {day === today && <span className="ml-2 text-sm text-indigo-700">วันนี้</span>}
              </h2>
              {list.length === 0 ? (
                <p className="text-sm text-slate-400">ไม่มีคลาส</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {list.map((s) => {
                    const booked = s.class_bookings.filter((b) => b.status !== "cancelled").length;
                    return (
                      <li key={s.id} data-testid="session">
                        <Link
                          href={`/classes/${s.id}`}
                          className={`flex flex-wrap items-center justify-between gap-2 py-2 hover:bg-slate-50 ${s.cancelled ? "text-slate-400 line-through" : ""}`}
                        >
                          <span>
                            <span className="font-mono">{formatTime(s.starts_at)}</span> {s.class_types?.name}
                            {s.trainers && <span className="text-slate-500"> · {s.trainers.name}</span>}
                          </span>
                          <span className="flex items-center gap-2 text-sm no-underline">
                            จองแล้ว {booked}/{s.capacity}
                            {s.cancelled && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">ยกเลิก</span>}
                            {!s.cancelled && booked >= s.capacity && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">เต็ม</span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
