"use server";

import { searchMembers } from "@/lib/members/queries";
import type { toSaleItems } from "@/lib/sales/cart";
import type { PaymentMethod } from "@/lib/sales/format";
import { createClient } from "@/lib/supabase/server";

export type MemberHit = { id: string; name: string; member_code: string; phone: string | null };

export async function findMembers(q: string): Promise<MemberHit[]> {
  if (!q.trim()) return [];
  const members = await searchMembers(q);
  return members.slice(0, 10).map(({ id, name, member_code, phone }) => ({ id, name, member_code, phone }));
}

export type SubmitSaleInput = {
  clientRequestId: string;
  memberId: string;
  items: ReturnType<typeof toSaleItems>;
  discount: number;
  paymentMethod: PaymentMethod;
};

export async function submitSale(input: SubmitSaleInput): Promise<{ saleId: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sale", {
    p_client_request_id: input.clientRequestId,
    p_member_id: input.memberId,
    p_items: input.items,
    p_discount: input.discount,
    p_payment_method: input.paymentMethod,
  });
  if (error) {
    // create_sale raises its business errors (P0001) in Thai, ready to show.
    return { error: error.code === "P0001" ? error.message : "บันทึกไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่" };
  }
  return { saleId: (data as { sale_id: string }).sale_id };
}
