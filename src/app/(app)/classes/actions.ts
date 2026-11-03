"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { addDays, bangkokToIso } from "@/lib/classes/time";
import { createClient } from "@/lib/supabase/server";

export type ClassActionState = { error?: string };

function message(error: { code?: string; message: string }, fallback: string) {
  return error.code === "P0001" ? error.message : fallback;
}

/** Owner adds a session, optionally repeated weekly, then opens the first one. */
export async function createSessions(_prev: ClassActionState, formData: FormData): Promise<ClassActionState> {
  await requireOwner();
  const classTypeId = String(formData.get("class_type_id") ?? "");
  const trainerId = String(formData.get("trainer_id") ?? "") || null;
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const duration = Number(formData.get("duration_minutes") || 60);
  const repeat = Number(formData.get("repeat_weeks") || 1);
  const capacityRaw = String(formData.get("capacity") ?? "").trim();

  if (!classTypeId) return { error: "กรุณาเลือกชนิดคลาส" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "กรุณาระบุวันที่และเวลาเริ่ม" };
  if (!Number.isInteger(duration) || duration < 10 || duration > 480) return { error: "ระยะเวลาต้องอยู่ระหว่าง 10–480 นาที" };
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 12) return { error: "ทำซ้ำได้ 1–12 ครั้ง" };

  const supabase = await createClient();
  const { data: type } = await supabase.from("class_types").select("default_capacity").eq("id", classTypeId).single();
  const capacity = capacityRaw ? Number(capacityRaw) : (type?.default_capacity ?? 0);
  if (!Number.isInteger(capacity) || capacity < 1) return { error: "จำนวนที่นั่งต้องเป็นจำนวนเต็มตั้งแต่ 1" };

  const firstStart = new Date(bangkokToIso(date, time));
  if (firstStart.getTime() < Date.now()) return { error: "วันเวลาเริ่มต้องไม่ย้อนหลัง" };

  const rows = Array.from({ length: repeat }, (_, week) => {
    const starts = new Date(bangkokToIso(addDays(date, week * 7), time));
    return {
      class_type_id: classTypeId,
      trainer_id: trainerId,
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + duration * 60_000).toISOString(),
      capacity,
    };
  });
  const { data, error } = await supabase.from("class_sessions").insert(rows).select("id, starts_at").order("starts_at");
  if (error || !data?.length) return { error: "บันทึกรอบคลาสไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath("/classes");
  redirect(`/classes/${data[0].id}`);
}

export async function cancelSession(sessionId: string) {
  await requireOwner();
  const supabase = await createClient();
  await supabase.from("class_sessions").update({ cancelled: true }).eq("id", sessionId);
  revalidatePath("/classes", "layout");
}

export async function bookMember(sessionId: string, memberId: string): Promise<ClassActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("book_class", { p_session_id: sessionId, p_member_id: memberId });
  if (error) return { error: message(error, "จองไม่สำเร็จ กรุณาลองใหม่") };
  revalidatePath("/classes", "layout");
  return {};
}

export async function cancelBooking(bookingId: string): Promise<ClassActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
  if (error) return { error: message(error, "ยกเลิกจองไม่สำเร็จ กรุณาลองใหม่") };
  revalidatePath("/classes", "layout");
  return {};
}

export async function markAttendance(bookingId: string, attended: boolean): Promise<ClassActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_attendance", { p_booking_id: bookingId, p_attended: attended });
  if (error) return { error: message(error, "เช็กชื่อไม่สำเร็จ กรุณาลองใหม่") };
  revalidatePath("/classes", "layout");
  revalidatePath("/");
  return {};
}
