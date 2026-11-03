"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { memberSchema } from "@/lib/members/schema";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type MemberFormState = { error?: string; saved?: boolean };

function parseForm(formData: FormData) {
  return memberSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    line_id: formData.get("line_id") ?? "",
    note: formData.get("note") ?? "",
  });
}

function toRow(data: ReturnType<typeof memberSchema.parse>) {
  return { name: data.name, phone: data.phone ?? null, line_id: data.line_id ?? null, note: data.note ?? null };
}

export async function createMember(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.from("members").insert(toRow(parsed.data)).select("id").single();
  if (error) return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath("/members");
  redirect(`/members/${data.id}`);
}

export async function updateMember(id: string, _prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("members").update(toRow(parsed.data)).eq("id", id);
  if (error) return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath("/members");
  return { saved: true };
}

/** Owner only (spec §3). The database trigger enforces this too. */
export async function setMemberActive(id: string, active: boolean) {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("members").update({ active }).eq("id", id);
  if (error) throw new Error("เปลี่ยนสถานะไม่สำเร็จ");
  revalidatePath(`/members/${id}`);
  revalidatePath("/members");
}

/** Points the member at their photo, already uploaded to member-photos/{id}.jpg. */
export async function setMemberPhoto(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("members").update({ photo_url: `${id}.jpg` }).eq("id", id);
  if (error) return { error: "บันทึกรูปไม่สำเร็จ" };
  revalidatePath(`/members/${id}`);
  return {};
}
