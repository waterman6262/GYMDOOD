"use server";

import { revalidatePath } from "next/cache";
import { normalizeCode, type CheckInResult } from "@/lib/checkin/types";
import { getPhotoUrls } from "@/lib/members/photos";
import { searchMembers } from "@/lib/members/queries";
import { createClient } from "@/lib/supabase/server";
import type { MemberHit } from "../sell/actions";

/** An exact member-code match (from a scan) or name/phone search results. */
export async function findForCheckIn(input: string): Promise<{ exact: MemberHit | null; hits: MemberHit[] }> {
  const text = input.trim();
  if (!text) return { exact: null, hits: [] };

  const supabase = await createClient();
  const { data: exact } = await supabase
    .from("members")
    .select("id, name, member_code, phone")
    .eq("member_code", normalizeCode(text))
    .eq("active", true)
    .maybeSingle();
  if (exact) return { exact, hits: [] };

  const hits = await searchMembers(text);
  return { exact: null, hits: hits.slice(0, 10).map(({ id, name, member_code, phone }) => ({ id, name, member_code, phone })) };
}

export async function checkInMember(memberId: string, overrideReason?: string): Promise<CheckInResult | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in", {
    p_member_id: memberId,
    p_override_reason: overrideReason ?? null,
  });
  if (error) {
    return { error: error.code === "P0001" ? error.message : "เช็กอินไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่" };
  }
  revalidatePath("/");
  const result = data as CheckInResult;
  const { data: member } = await supabase.from("members").select("photo_url").eq("id", memberId).single();
  const photos = await getPhotoUrls([member?.photo_url]);
  return { ...result, photo_url: member?.photo_url ? (photos[member.photo_url] ?? null) : null };
}
