"use client";

import { useActionState } from "react";
import { useOnline } from "@/components/online-status";
import type { Member } from "@/lib/members/queries";
import type { MemberFormState } from "./actions";

type Props = {
  action: (prev: MemberFormState, formData: FormData) => Promise<MemberFormState>;
  member?: Member;
};

export function MemberForm({ action, member }: Props) {
  const online = useOnline();
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="card max-w-xl space-y-4">
      <label className="block">
        <span className="field-label">ชื่อ-นามสกุล</span>
        <input name="name" required defaultValue={member?.name} className="input" />
      </label>
      <label className="block">
        <span className="field-label">เบอร์โทร</span>
        <input name="phone" inputMode="tel" defaultValue={member?.phone ?? ""} className="input" />
      </label>
      <label className="block">
        <span className="field-label">LINE ID</span>
        <input name="line_id" defaultValue={member?.line_id ?? ""} className="input" />
      </label>
      <label className="block">
        <span className="field-label">หมายเหตุ</span>
        <textarea name="note" rows={2} defaultValue={member?.note ?? ""} className="input" />
      </label>
      {state.error && (
        <p role="alert" className="field-error">
          {state.error}
        </p>
      )}
      {state.saved && <p className="text-sm text-green-700">บันทึกแล้ว</p>}
      <button type="submit" disabled={pending || !online} className="btn-primary">
        {pending ? "กำลังบันทึก…" : "บันทึก"}
      </button>
    </form>
  );
}
