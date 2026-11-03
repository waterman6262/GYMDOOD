import type { PackageKind } from "@/lib/packages/schema";

export type DenyReason = "frozen" | "used_up" | "expired" | "not_started" | "none";

/** Shape returned by the check_in database function (plus a signed photo URL). */
export type CheckInResult = {
  status: "ok" | "warning" | "denied";
  check_in_id: string | null;
  reason: DenyReason | null;
  membership: {
    id: string;
    package_name: string;
    kind: PackageKind;
    end_date: string;
    visits_left: number | null;
  } | null;
  days_left: number | null;
  visit_deducted: boolean;
  already_today: boolean;
  next_start_date: string | null;
  member: { id: string; name: string; member_code: string };
  photo_url?: string | null;
};

export const DENY_REASON_LABELS: Record<DenyReason, string> = {
  frozen: "พักสมาชิกอยู่",
  used_up: "ใช้ครบจำนวนครั้งแล้ว",
  expired: "แพ็กเกจหมดอายุ",
  not_started: "แพ็กเกจยังไม่เริ่ม",
  none: "ยังไม่มีแพ็กเกจ",
};

/** What a scanner or a person typed, as a member code: no spaces, upper case. */
export function normalizeCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}
