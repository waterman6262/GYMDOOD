import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PackageKind } from "@/lib/packages/schema";

export type MembershipState = "active" | "frozen" | "upcoming" | "expired" | "cancelled";

export type FreezeView = { id: string; start_date: string; end_date: string; reason: string };

export type MembershipView = {
  id: string;
  package_name: string;
  kind: PackageKind;
  start_date: string;
  end_date: string;
  visits_left: number | null;
  pt_left: number | null;
  state: MembershipState;
  /** Active freezes that haven't ended yet. */
  freezes: FreezeView[];
};

export const MEMBERSHIP_STATE_LABELS: Record<MembershipState, string> = {
  active: "ใช้งานได้",
  frozen: "พักอยู่",
  upcoming: "รอเริ่ม",
  expired: "หมดอายุ",
  cancelled: "ยกเลิก",
};

export function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

/** A member's packages, newest first, with a state computed for today (Bangkok). */
export async function getMemberships(memberId: string): Promise<MembershipView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, kind, start_date, end_date, visits_left, pt_left, status, package_types(name), freezes(id, start_date, end_date, reason, status)")
    .eq("member_id", memberId)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const today = bangkokToday();
  return data.map((m) => {
    const freezes = ((m.freezes ?? []) as (FreezeView & { status: string })[])
      .filter((f) => f.status === "active" && f.end_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .map(({ id, start_date, end_date, reason }) => ({ id, start_date, end_date, reason }));
    const frozenToday = freezes.some((f) => f.start_date <= today && today <= f.end_date);
    const usedUp = (m.kind === "visits" && (m.visits_left ?? 0) <= 0) || (m.kind === "pt" && (m.pt_left ?? 0) <= 0);
    const state: MembershipState =
      m.status === "cancelled"
        ? "cancelled"
        : m.end_date < today || usedUp
          ? "expired"
          : frozenToday
            ? "frozen"
            : m.start_date > today
              ? "upcoming"
              : "active";
    const pkg = m.package_types as unknown as { name: string } | null;
    return {
      id: m.id,
      package_name: pkg?.name ?? "",
      kind: m.kind as PackageKind,
      start_date: m.start_date,
      end_date: m.end_date,
      visits_left: m.visits_left,
      pt_left: m.pt_left,
      state,
      freezes,
    };
  });
}
