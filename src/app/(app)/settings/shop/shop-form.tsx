"use client";

import { useActionState } from "react";
import type { ShopSettings } from "@/lib/settings/schema";
import { saveShopSettings, type ShopFormState } from "./actions";

export function ShopForm({ settings }: { settings: ShopSettings }) {
  const [state, formAction, pending] = useActionState<ShopFormState, FormData>(saveShopSettings, {});

  return (
    <form action={formAction} className="card max-w-xl space-y-4">
      <label className="block">
        <span className="field-label">ชื่อยิม</span>
        <input name="gym_name" defaultValue={settings.gym_name} className="input" />
      </label>
      <label className="block">
        <span className="field-label">ที่อยู่</span>
        <textarea name="address" rows={2} defaultValue={settings.address} className="input" />
      </label>
      <label className="block">
        <span className="field-label">เบอร์โทรร้าน</span>
        <input name="phone" inputMode="tel" defaultValue={settings.phone} className="input" />
      </label>
      <label className="block">
        <span className="field-label">เลข PromptPay</span>
        <input
          name="promptpay_id"
          inputMode="numeric"
          placeholder="เบอร์มือถือ หรือเลขประจำตัว 13 หลัก"
          defaultValue={settings.promptpay_id}
          className="input"
        />
      </label>
      <label className="block">
        <span className="field-label">ข้อความท้ายใบเสร็จ</span>
        <input name="receipt_footer" defaultValue={settings.receipt_footer} className="input" />
      </label>
      {state.error && (
        <p role="alert" className="field-error">
          {state.error}
        </p>
      )}
      {state.saved && !pending && <p className="text-sm text-green-700">บันทึกแล้ว</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "กำลังบันทึก…" : "บันทึก"}
      </button>
    </form>
  );
}
