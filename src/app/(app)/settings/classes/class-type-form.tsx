"use client";

import { useActionState } from "react";
import { useOnline } from "@/components/online-status";
import { saveClassType, type SettingsFormState } from "./actions";

export function ClassTypeForm() {
  const online = useOnline();
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(saveClassType, {});

  return (
    <form key={state.savedAt} action={formAction} className="card grid gap-4 sm:grid-cols-3">
      <h2 className="text-lg font-semibold sm:col-span-3">เพิ่มชนิดคลาส</h2>
      <label className="block sm:col-span-2">
        <span className="field-label">ชื่อคลาส</span>
        <input name="name" required className="input" />
      </label>
      <label className="block">
        <span className="field-label">จำนวนที่นั่ง</span>
        <input name="default_capacity" type="number" defaultValue={15} className="input" />
      </label>
      {state.error && (
        <p role="alert" className="field-error sm:col-span-3">
          {state.error}
        </p>
      )}
      <div className="sm:col-span-3">
        <button type="submit" disabled={pending || !online} className="btn-primary">
          บันทึกคลาส
        </button>
      </div>
    </form>
  );
}
