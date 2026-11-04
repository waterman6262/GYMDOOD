"use client";

import { useActionState, useState } from "react";
import { useOnline } from "@/components/online-status";
import { voidSale, type VoidState } from "../actions";

export function VoidForm({ saleId }: { saleId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<VoidState, FormData>(voidSale.bind(null, saleId), {});
  const online = useOnline();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-danger">
        ยกเลิกบิล
      </button>
    );
  }

  return (
    <form action={formAction} className="card w-full max-w-sm space-y-3 ring-red-200">
      <label className="block">
        <span className="field-label">เหตุผลที่ยกเลิก</span>
        <input name="reason" className="input" autoFocus />
      </label>
      {state.error && (
        <p role="alert" className="field-error">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending || !online} className="btn-danger">
          {pending ? "กำลังยกเลิก…" : "ยืนยันยกเลิกบิล"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn">
          ไม่ยกเลิก
        </button>
      </div>
    </form>
  );
}
