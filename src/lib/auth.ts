import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Staff = { id: string; name: string; role: "owner" | "staff" };

/** The signed-in, active staff member, or null. Cached per request. */
export const getCurrentStaff = cache(async (): Promise<Staff | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("staff")
    .select("id, name, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  return (data as Staff | null) ?? null;
});

/**
 * For owner-only pages. Call in the page itself, not only its layout: a
 * client-side navigation can render the page segment without the layout.
 */
export async function requireOwnerPage(): Promise<Staff> {
  const staff = await getCurrentStaff();
  if (staff?.role !== "owner") redirect("/");
  return staff;
}

/** Throws unless the caller is an active owner. Use at the top of owner-only actions. */
export async function requireOwner(): Promise<Staff> {
  const staff = await getCurrentStaff();
  if (staff?.role !== "owner") throw new Error("เฉพาะเจ้าของเท่านั้น");
  return staff;
}
