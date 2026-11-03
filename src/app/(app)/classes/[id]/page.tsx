import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { bangkokDateOf, formatTime, isPast } from "@/lib/classes/time";
import { formatThaiDate } from "@/lib/sales/format";
import { createClient } from "@/lib/supabase/server";
import { cancelSession } from "../actions";
import { Roster, type RosterEntry } from "./roster";

type SessionDetail = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  cancelled: boolean;
  class_types: { name: string } | null;
  trainers: { name: string } | null;
  class_bookings: { id: string; status: string; created_at: string; members: { name: string; member_code: string } | null }[];
};

export default async function ClassSessionPage({ params }: PageProps<"/classes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, staff] = await Promise.all([
    supabase
      .from("class_sessions")
      .select(
        "id, starts_at, ends_at, capacity, cancelled, class_types(name), trainers(name), class_bookings(id, status, created_at, members(name, member_code))",
      )
      .eq("id", id)
      .maybeSingle(),
    getCurrentStaff(),
  ]);
  if (!data) notFound();
  const session = data as unknown as SessionDetail;

  const entries: RosterEntry[] = session.class_bookings
    .filter((b) => b.status !== "cancelled")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((b) => ({
      id: b.id,
      status: b.status as RosterEntry["status"],
      name: b.members?.name ?? "",
      member_code: b.members?.member_code ?? "",
    }));
  const ended = isPast(session.ends_at);

  return (
    <div className="space-y-6">
      <Link href={`/classes?week=${bangkokDateOf(session.starts_at)}`} className="text-sm text-indigo-700 hover:underline">
        ← กลับไปตารางคลาส
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{session.class_types?.name}</h1>
        <p className="text-slate-600">
          {formatThaiDate(bangkokDateOf(session.starts_at))} {formatTime(session.starts_at)}–{formatTime(session.ends_at)}
          {session.trainers && ` · ${session.trainers.name}`}
        </p>
        <p data-testid="booked-count" className="font-semibold">
          จองแล้ว {entries.length}/{session.capacity}
        </p>
        {session.cancelled && <p className="font-semibold text-red-700">รอบนี้ถูกยกเลิก</p>}
      </div>

      <Roster sessionId={session.id} entries={entries} open={!ended} cancelled={session.cancelled} />

      {staff?.role === "owner" && !session.cancelled && (
        <form action={cancelSession.bind(null, session.id)}>
          <button type="submit" className="btn-danger">
            ยกเลิกรอบคลาส
          </button>
        </form>
      )}
    </div>
  );
}
