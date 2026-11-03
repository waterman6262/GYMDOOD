"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { MemberPicker } from "../sell/member-picker";
import { cancelPt, completePt, createPtAppointment, type PtState } from "./actions";

type Option = { id: string; label: string };

export function PtScheduler({
  member,
  ptPackages,
  trainers,
  today,
}: {
  member: { id: string; name: string } | null;
  ptPackages: Option[];
  trainers: Option[];
  today: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<PtState, FormData>(createPtAppointment, {});

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold">นัด PT ใหม่</h2>
      <MemberPicker label="ค้นหาสมาชิก" onPick={(m) => router.push(`/pt?member=${m.id}`)} />
      {member && (
        <p data-testid="pt-member" className="rounded-lg bg-slate-50 p-3">
          สมาชิก: <span className="font-semibold">{member.name}</span>
        </p>
      )}
      {member && ptPackages.length === 0 && (
        <p className="text-amber-800">
          สมาชิกนี้ไม่มีแพ็กเกจ PT ที่ใช้ได้{" "}
          <Link href={`/sell?member=${member.id}`} className="font-medium text-indigo-700 underline">
            ขายแพ็กเกจ
          </Link>
        </p>
      )}
      {member && ptPackages.length > 0 && (
        <form key={state.savedAt} action={formAction} className="grid gap-4 sm:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className="field-label">แพ็กเกจ PT</span>
            <select name="membership_id" required className="input">
              {ptPackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="field-label">เทรนเนอร์</span>
            <select name="trainer_id" required className="input">
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">วันที่</span>
            <input type="date" name="date" defaultValue={today} required className="input" />
          </label>
          <label className="block">
            <span className="field-label">เวลา</span>
            <input type="time" name="time" required className="input" />
          </label>
          {state.error && (
            <p role="alert" className="field-error sm:col-span-4">
              {state.error}
            </p>
          )}
          <div className="sm:col-span-4">
            <button type="submit" disabled={pending} className="btn-primary">
              บันทึกนัด
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function PtActions({ appointmentId }: { appointmentId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<PtState>) =>
    startTransition(async () => {
      const res = await action();
      setError(res.error ?? null);
    });

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => run(() => completePt(appointmentId))} className="btn-primary">
        เทรนแล้ว
      </button>
      <button type="button" disabled={pending} onClick={() => run(() => cancelPt(appointmentId))} className="btn">
        ยกเลิกนัด
      </button>
      {error && (
        <span role="alert" className="text-sm text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
