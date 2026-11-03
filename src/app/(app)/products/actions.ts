"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { productSchema } from "@/lib/products/schema";
import { createClient } from "@/lib/supabase/server";

export type ProductFormState = { error?: string; savedAt?: number };

function done(): ProductFormState {
  revalidatePath("/products", "layout");
  revalidatePath("/sell");
  return { savedAt: Date.now() };
}

function fail(error: { code?: string; message: string }, fallback: string): ProductFormState {
  return { error: error.code === "P0001" ? error.message : fallback };
}

export async function receiveStock(productId: string, _prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const qty = Number(formData.get("qty"));
  if (!Number.isInteger(qty) || qty <= 0) return { error: "จำนวนรับเข้าต้องเป็นจำนวนเต็มมากกว่า 0" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_stock", {
    p_product_id: productId,
    p_qty: qty,
    p_note: String(formData.get("note") ?? ""),
  });
  return error ? fail(error, "บันทึกรับเข้าไม่สำเร็จ กรุณาลองใหม่") : done();
}

export async function adjustStock(productId: string, _prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireOwner();
  const counted = Number(formData.get("counted"));
  if (!Number.isInteger(counted) || counted < 0) return { error: "จำนวนที่นับได้ต้องเป็นจำนวนเต็มไม่ติดลบ" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_counted: counted,
    p_note: String(formData.get("note") ?? ""),
  });
  return error ? fail(error, "ปรับยอดไม่สำเร็จ กรุณาลองใหม่") : done();
}

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireOwner();
  const id = String(formData.get("id") ?? "") || undefined;
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("products").update(parsed.data).eq("id", id)
    : await supabase.from("products").insert(parsed.data);
  return error ? { error: "บันทึกสินค้าไม่สำเร็จ กรุณาลองใหม่" } : done();
}

export async function setProductActive(productId: string, active: boolean): Promise<ProductFormState> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ active }).eq("id", productId);
  return error ? { error: "เปลี่ยนสถานะไม่สำเร็จ" } : done();
}
