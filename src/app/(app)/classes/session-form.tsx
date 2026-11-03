"use client";

import { useActionState } from "react";
import { createSessions, type ClassActionState } from "./actions";

type Option = { id: string; name: string };

export function SessionForm({ classTypes, trainers, today }: { classTypes: Option[]; trainers: Option[]; today: string }) {
  const [state, formAction, pending] = useActionState<ClassActionState, FormData>(createSessions, {});

  return (
    <form action={formAction} className="card grid gap-4 sm:grid-cols-4">
      <h2 className="text-lg font-semibold sm:col-span-4">เพิ่มรอบคลาส</h2>
      <label className="block sm:col-span-2">
        <span className="field-label">ชนิดคลาส</span>
        <select name="class_type_id" required className="input">
          {classTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="field-label">เทรนเนอร์</span>
        <select name="trainer_id" className="input">
          <option value="">ไม่ระบุ</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="field-label">วันที่</span>
        <input type="date" name="date" defaultValue={today} min={today} required className="input" />
      </label>
      <label className="block">
        <span className="field-label">เวลาเริ่ม</span>
        <input type="time" name="time" required className="input" />
      </label>
      <label className="block">
        <span className="field-label">ระยะเวลา (นาที)</span>
        <input type="number" name="duration_minutes" defaultValue={60} className="input" />
      </label>
      <label className="block">
        <span className="field-label">จำนวนที่นั่ง</span>
        <input type="number" name="capacity" placeholder="ตามชนิดคลาส" className="input" />
      </label>
      <label className="block">
        <span className="field-label">ทำซ้ำทุกสัปดาห์ (ครั้ง)</span>
        <input type="number" name="repeat_weeks" defaultValue={1} className="input" />
      </label>
      {state.error && (
        <p role="alert" className="field-error sm:col-span-4">
          {state.error}
        </p>
      )}
      <div className="sm:col-span-4">
        <button type="submit" disabled={pending || classTypes.length === 0} className="btn-primary">
          บันทึกรอบคลาส
        </button>
        {classTypes.length === 0 && <span className="ml-3 text-sm text-slate-500">เพิ่มชนิดคลาสที่ ตั้งค่า → คลาส ก่อน</span>}
      </div>
    </form>
  );
}
