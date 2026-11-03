"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveProduct, type ProductFormState } from "./actions";

export type ProductRowData = {
  id: string;
  name: string;
  price: number;
  track_stock: boolean;
  stock_qty: number;
  low_stock_at: number;
  active: boolean;
};

/** Owner's add / edit form. */
export function ProductForm({ editing }: { editing?: ProductRowData }) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(saveProduct, {});

  return (
    <form key={state.savedAt} action={formAction} className="card grid gap-4 sm:grid-cols-4">
      <h2 className="text-lg font-semibold sm:col-span-4">{editing ? `แก้ไข: ${editing.name}` : "เพิ่มสินค้า"}</h2>
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <label className="block sm:col-span-2">
        <span className="field-label">ชื่อสินค้า</span>
        <input name="name" required defaultValue={editing?.name} className="input" />
      </label>
      <label className="block">
        <span className="field-label">ราคา (บาท)</span>
        <input name="price" type="number" min={0} step="0.01" required defaultValue={editing?.price} className="input" />
      </label>
      <label className="block">
        <span className="field-label">เตือนเมื่อเหลือ</span>
        <input name="low_stock_at" type="number" min={0} step={1} defaultValue={editing?.low_stock_at ?? 5} className="input" />
      </label>
      <label className="flex items-center gap-2 sm:col-span-4">
        <input type="checkbox" name="track_stock" defaultChecked={editing?.track_stock ?? true} className="size-5" />
        นับสต็อก
        <span className="text-sm text-slate-500">(ไม่ต้องติ๊กสำหรับบริการ เช่น ค่าเช่าล็อกเกอร์)</span>
      </label>
      {editing && !editing.track_stock && (
        <p className="text-sm text-amber-700 sm:col-span-4">
          ถ้าเปิดนับสต็อก ยอดจะเริ่มที่ 0 แล้วกด &quot;ปรับยอด&quot; ตามจำนวนที่นับได้จริง
        </p>
      )}
      {state.error && (
        <p role="alert" className="field-error sm:col-span-4">
          {state.error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-4">
        <button type="submit" disabled={pending} className="btn-primary">
          บันทึกสินค้า
        </button>
        {editing && (
          <Link href="/products" className="btn">
            ยกเลิกการแก้ไข
          </Link>
        )}
      </div>
    </form>
  );
}
