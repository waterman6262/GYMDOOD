"use client";

import { useActionState, useState } from "react";
import { useOnline } from "@/components/online-status";
import { PACKAGE_KIND_LABELS, type PackageKind } from "@/lib/packages/schema";
import { savePackageType, type PackageFormState } from "./actions";

export type PackageTypeRow = {
  id: string;
  name: string;
  kind: PackageKind;
  price: number;
  duration_days: number | null;
  visits: number | null;
  pt_sessions: number | null;
  seats: number;
  tag: string | null;
  active: boolean;
};

export function PackageForm({ editing }: { editing?: PackageTypeRow }) {
  const online = useOnline();
  const [state, formAction, pending] = useActionState<PackageFormState, FormData>(savePackageType, {});
  const [kind, setKind] = useState<PackageKind>(editing?.kind ?? "duration");

  return (
    // Remount after each successful save so a new package starts from a blank form.
    <form key={state.savedAt} action={formAction} className="card grid gap-4 sm:grid-cols-2">
      <h2 className="text-lg font-semibold sm:col-span-2">{editing ? `แก้ไข: ${editing.name}` : "เพิ่มแพ็กเกจ"}</h2>
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <label className="block sm:col-span-2">
        <span className="field-label">ชื่อแพ็กเกจ</span>
        <input name="name" required defaultValue={editing?.name} className="input" />
      </label>
      <label className="block">
        <span className="field-label">ชนิด</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as PackageKind)} className="input">
          {(Object.keys(PACKAGE_KIND_LABELS) as PackageKind[]).map((k) => (
            <option key={k} value={k}>
              {PACKAGE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="field-label">ราคา (บาท)</span>
        <input name="price" type="number" min={0} step="0.01" required defaultValue={editing?.price} className="input" />
      </label>
      {kind === "visits" && (
        <label className="block">
          <span className="field-label">จำนวนครั้ง</span>
          <input name="visits" type="number" min={1} defaultValue={editing?.visits ?? ""} className="input" />
        </label>
      )}
      {kind === "pt" && (
        <label className="block">
          <span className="field-label">จำนวนชั่วโมง PT</span>
          <input name="pt_sessions" type="number" min={1} defaultValue={editing?.pt_sessions ?? ""} className="input" />
        </label>
      )}
      {kind !== "day" && (
        <label className="block">
          <span className="field-label">ใช้ได้ภายใน (วัน)</span>
          <input name="duration_days" type="number" min={1} defaultValue={editing?.duration_days ?? ""} className="input" />
        </label>
      )}
      <label className="block">
        <span className="field-label">จำนวนสิทธิ์ต่อการขาย</span>
        <select name="seats" defaultValue={editing?.seats ?? 1} className="input">
          <option value={1}>1 คน</option>
          <option value={2}>2 คน (แพ็กเกจคู่)</option>
        </select>
      </label>
      <label className="block">
        <span className="field-label">ป้าย</span>
        <input name="tag" placeholder="เช่น นักเรียน" defaultValue={editing?.tag ?? ""} className="input" />
      </label>
      {state.error && (
        <p role="alert" className="field-error sm:col-span-2">
          {state.error}
        </p>
      )}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending || !online} className="btn-primary">
          {pending ? "กำลังบันทึก…" : "บันทึกแพ็กเกจ"}
        </button>
      </div>
    </form>
  );
}
