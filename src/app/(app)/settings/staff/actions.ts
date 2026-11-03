"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { staffAccountSchema } from "@/lib/settings/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type StaffFormState = { error?: string; savedAt?: number };

export async function createStaffAccount(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  await requireOwner();
  const parsed = staffAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, role } = parsed.data;

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !created.user) {
    return { error: authError?.code === "email_exists" ? "อีเมลนี้มีบัญชีอยู่แล้ว" : "สร้างบัญชีไม่สำเร็จ" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("staff").insert({ user_id: created.user.id, name, role });
  if (error) {
    // Don't leave a login that has no staff row behind.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "สร้างบัญชีไม่สำเร็จ" };
  }

  revalidatePath("/settings/staff");
  return { savedAt: Date.now() };
}

export type StaffActiveState = { error?: string };

export async function setStaffActive(staffId: string, active: boolean): Promise<StaffActiveState> {
  const owner = await requireOwner();
  if (staffId === owner.id && !active) return { error: "ไม่สามารถปิดบัญชีของตัวเองได้" };

  const supabase = await createClient();
  const { error } = await supabase.from("staff").update({ active }).eq("id", staffId);
  if (error) return { error: "เปลี่ยนสถานะไม่สำเร็จ" };

  revalidatePath("/settings/staff");
  return {};
}
