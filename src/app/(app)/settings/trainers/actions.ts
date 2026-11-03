"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import type { SettingsFormState } from "../classes/actions";

const trainerSchema = z.object({
  name: z.string().trim().min(1, { error: "กรุณากรอกชื่อเทรนเนอร์" }),
  phone: z
    .string()
    .optional()
    .transform((v) => (v ? normalizePhone(v) : null))
    .refine((v) => v === null || /^0\d{8,9}$/.test(v), { error: "เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0" }),
});

export async function saveTrainer(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireOwner();
  const parsed = trainerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("trainers").insert(parsed.data);
  if (error) return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  revalidatePath("/settings/trainers");
  return { savedAt: Date.now() };
}

export async function setTrainerActive(id: string, active: boolean) {
  await requireOwner();
  const supabase = await createClient();
  await supabase.from("trainers").update({ active }).eq("id", id);
  revalidatePath("/settings/trainers");
}
