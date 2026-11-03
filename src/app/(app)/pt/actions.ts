"use server";

import { revalidatePath } from "next/cache";
import { bangkokToIso } from "@/lib/classes/time";
import { createClient } from "@/lib/supabase/server";

export type PtState = { error?: string; savedAt?: number; ptLeft?: number };

function message(error: { code?: string; message: string }, fallback: string) {
  return error.code === "P0001" ? error.message : fallback;
}

function refresh() {
  revalidatePath("/pt");
  revalidatePath("/members", "layout");
}

export async function createPtAppointment(_prev: PtState, formData: FormData): Promise<PtState> {
  const membershipId = String(formData.get("membership_id") ?? "");
  const trainerId = String(formData.get("trainer_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  if (!membershipId) return { error: "กรุณาเลือกแพ็กเกจ PT" };
  if (!trainerId) return { error: "กรุณาเลือกเทรนเนอร์" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "กรุณาระบุวันที่และเวลา" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_pt_appointment", {
    p_membership_id: membershipId,
    p_trainer_id: trainerId,
    p_starts_at: bangkokToIso(date, time),
  });
  if (error) return { error: message(error, "บันทึกนัดไม่สำเร็จ กรุณาลองใหม่") };
  refresh();
  return { savedAt: Date.now() };
}

export async function completePt(appointmentId: string): Promise<PtState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_pt", { p_appointment_id: appointmentId });
  if (error) return { error: message(error, "บันทึกไม่สำเร็จ กรุณาลองใหม่") };
  refresh();
  return { ptLeft: data as number };
}

export async function cancelPt(appointmentId: string): Promise<PtState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_pt", { p_appointment_id: appointmentId });
  if (error) return { error: message(error, "ยกเลิกนัดไม่สำเร็จ กรุณาลองใหม่") };
  refresh();
  return {};
}
