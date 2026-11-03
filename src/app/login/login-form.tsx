"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

export function LoginForm({ inactive }: { inactive: boolean }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    signIn,
    inactive ? { error: "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อเจ้าของยิม" } : {},
  );

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow">
      <h1 className="text-2xl font-bold">GYMDOOD POS</h1>
      <label className="block">
        <span className="field-label">อีเมล</span>
        <input name="email" type="email" autoComplete="username" required className="input" />
      </label>
      <label className="block">
        <span className="field-label">รหัสผ่าน</span>
        <input name="password" type="password" autoComplete="current-password" required className="input" />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
