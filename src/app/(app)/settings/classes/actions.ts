"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SettingsFormState = { error?: string; savedAt?: number };

const CAPACITY_ERROR = "จำนวนที่นั่งต้องเป็นจำนวนเต็มตั้งแต่ 1";

const classTypeSchema = z.object({
  name: z.string().trim().min(1, { error: "กรุณากรอกชื่อคลาส" }),
  default_capacity: z.coerce
    .number({ error: CAPACITY_ERROR })
    .int({ error: CAPACITY_ERROR })
    .min(1, { error: CAPACITY_ERROR }),
});

export async function saveClassType(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireOwner();
  const parsed = classTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("class_types").insert(parsed.data);
  if (error) return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  revalidatePath("/settings/classes");
  return { savedAt: Date.now() };
}

export async function setClassTypeActive(id: string, active: boolean) {
  await requireOwner();
  const supabase = await createClient();
  await supabase.from("class_types").update({ active }).eq("id", id);
  revalidatePath("/settings/classes");
}
