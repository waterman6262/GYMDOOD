"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { packageTypeSchema } from "@/lib/packages/schema";
import { createClient } from "@/lib/supabase/server";

export type PackageFormState = { error?: string; savedAt?: number };

export async function savePackageType(_prev: PackageFormState, formData: FormData): Promise<PackageFormState> {
  await requireOwner();
  const id = String(formData.get("id") ?? "") || undefined;
  const parsed = packageTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const p = parsed.data;
  const row = {
    name: p.name,
    kind: p.kind,
    price: p.price,
    duration_days: p.duration_days,
    visits: p.kind === "visits" ? p.visits : null,
    pt_sessions: p.kind === "pt" ? p.pt_sessions : null,
    seats: p.seats,
    tag: p.tag ?? null,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("package_types").update(row).eq("id", id)
    : await supabase.from("package_types").insert(row);
  if (error) return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath("/settings/packages");
  return { savedAt: Date.now() };
}

/** Inactive package types are hidden from the sell screen; past sales keep them. */
export async function setPackageTypeActive(id: string, active: boolean) {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("package_types").update({ active }).eq("id", id);
  if (error) throw new Error("เปลี่ยนสถานะไม่สำเร็จ");
  revalidatePath("/settings/packages");
}
