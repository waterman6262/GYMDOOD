"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { shopSettingsSchema } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/server";

export type ShopFormState = { error?: string; saved?: boolean };

export async function saveShopSettings(_prev: ShopFormState, formData: FormData): Promise<ShopFormState> {
  await requireOwner();
  const parsed = shopSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("settings").update(parsed.data).eq("id", 1);
  if (error) return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath("/settings/shop");
  return { saved: true };
}
