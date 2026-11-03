"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type VoidState = { error?: string };

/** Owner only. void_sale checks the owner, the reason and the bill's status itself. */
export async function voidSale(saleId: string, _prev: VoidState, formData: FormData): Promise<VoidState> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", {
    p_sale_id: saleId,
    p_reason: String(formData.get("reason") ?? ""),
  });
  if (error) return { error: error.code === "P0001" ? error.message : "ยกเลิกบิลไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath(`/sales/${saleId}`);
  revalidatePath("/sales");
  revalidatePath("/members", "layout");
  return {};
}
