"use client";

import { useActionState } from "react";
import { useOnline } from "@/components/online-status";
import type { SettingsFormState } from "../classes/actions";
import { saveTrainer } from "./actions";

export function TrainerForm() {
  const online = useOnline();
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(saveTrainer, {});

  return (
    <form key={state.savedAt} action={formAction} className="card grid gap-4 sm:grid-cols-2">
      <h2 className="text-lg font-semibold sm:col-span-2">เพิ่มเทรนเนอร์</h2>
      <label className="block">
        <span className="field-label">ชื่อเทรนเนอร์</span>
        <input name="name" required className="input" />
      </label>
      <label className="block">
        <span className="field-label">เบอร์โทร</span>
        <input name="phone" inputMode="tel" className="input" />
      </label>
      {state.error && (
        <p role="alert" className="field-error sm:col-span-2">
          {state.error}
        </p>
      )}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending || !online} className="btn-primary">
          บันทึกเทรนเนอร์
        </button>
      </div>
    </form>
  );
}
