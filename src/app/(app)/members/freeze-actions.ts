"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FreezeState = { error?: string; savedAt?: number };

function toMessage(error: { code?: string; message: string }, fallback: string) {
  return error.code === "P0001" ? error.message : fallback;
}

export async function freezeMembership(membershipId: string, _prev: FreezeState, formData: FormData): Promise<FreezeState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("freeze_membership", {
    p_membership_id: membershipId,
    p_start: String(formData.get("start_date") ?? "") || null,
    p_end: String(formData.get("end_date") ?? "") || null,
    p_reason: String(formData.get("reason") ?? ""),
  });
  if (error) return { error: toMessage(error, "บันทึกการพักไม่สำเร็จ กรุณาลองใหม่") };
  revalidatePath("/members", "layout");
  return { savedAt: Date.now() };
}

export async function unfreezeMembership(freezeId: string): Promise<FreezeState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unfreeze_membership", { p_freeze_id: freezeId });
  if (error) return { error: toMessage(error, "ยกเลิกการพักไม่สำเร็จ กรุณาลองใหม่") };
  revalidatePath("/members", "layout");
  return {};
}
