"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error?: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

  // RLS hides every staff row from a deactivated account, including its own.
  const { data: staff } = await supabase.from("staff").select("id").eq("active", true).limit(1);
  if (!staff?.length) {
    await supabase.auth.signOut();
    return { error: "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อเจ้าของยิม" };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
