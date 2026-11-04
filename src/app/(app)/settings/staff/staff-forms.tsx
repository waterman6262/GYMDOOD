"use client";

import { useActionState } from "react";
import { useOnline } from "@/components/online-status";
import { createStaffAccount, setStaffActive, type StaffActiveState, type StaffFormState } from "./actions";

export function NewStaffForm() {
  const online = useOnline();
  const [state, formAction, pending] = useActionState<StaffFormState, FormData>(createStaffAccount, {});

  return (
    <form key={state.savedAt} action={formAction} className="card grid gap-4 sm:grid-cols-2">
      <h2 className="text-lg font-semibold sm:col-span-2">เพิ่มบัญชีพนักงาน</h2>
      <label className="block">
        <span className="field-label">ชื่อ</span>
        <input name="name" required className="input" />
      </label>
      <label className="block">
        <span className="field-label">บทบาท</span>
        <select name="role" defaultValue="staff" className="input">
          <option value="staff">พนักงาน</option>
          <option value="owner">เจ้าของ</option>
        </select>
      </label>
      <label className="block">
        <span className="field-label">อีเมล</span>
        <input name="email" type="email" required autoComplete="off" className="input" />
      </label>
      <label className="block">
        <span className="field-label">รหัสผ่าน</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </label>
      {state.error && (
        <p role="alert" className="field-error sm:col-span-2">
          {state.error}
        </p>
      )}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending || !online} className="btn-primary">
          {pending ? "กำลังสร้าง…" : "สร้างบัญชี"}
        </button>
      </div>
    </form>
  );
}

export function StaffActiveButton({ staffId, active }: { staffId: string; active: boolean }) {
  const online = useOnline();
  const [state, formAction, pending] = useActionState<StaffActiveState>(() => setStaffActive(staffId, !active), {});

  return (
    <form action={formAction} className="flex items-center justify-end gap-3">
      {state.error && (
        <span role="alert" className="text-sm text-red-600">
          {state.error}
        </span>
      )}
      <button type="submit" disabled={pending || !online} className={active ? "btn-danger" : "btn"}>
        {active ? "ปิดบัญชี" : "เปิดบัญชี"}
      </button>
    </form>
  );
}
