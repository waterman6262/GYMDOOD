"use client";

import { useActionState, useState, useTransition } from "react";
import type { FreezeView } from "@/lib/memberships/queries";
import { formatThaiDate } from "@/lib/sales/format";
import { freezeMembership, unfreezeMembership, type FreezeState } from "../freeze-actions";

export function FreezeControls({
  membershipId,
  freezes,
  canFreeze,
  today,
}: {
  membershipId: string;
  freezes: FreezeView[];
  canFreeze: boolean;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FreezeState, FormData>(
    async (prev, formData) => {
      const res = await freezeMembership(membershipId, prev, formData);
      if (!res.error) setOpen(false);
      return res;
    },
    {},
  );
  const [unfreezeError, setUnfreezeError] = useState<string | null>(null);
  const [unfreezing, startUnfreeze] = useTransition();

  return (
    <div className="w-full space-y-2">
      {freezes.map((f) => (
        <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <span>
            พัก {formatThaiDate(f.start_date)} – {formatThaiDate(f.end_date)} · {f.reason}
          </span>
          <button
            type="button"
            disabled={unfreezing}
            onClick={() =>
              startUnfreeze(async () => {
                const res = await unfreezeMembership(f.id);
                setUnfreezeError(res.error ?? null);
              })
            }
            className="font-medium text-sky-700 underline"
          >
            ยกเลิกการพัก
          </button>
        </div>
      ))}
      {unfreezeError && (
        <p role="alert" className="field-error">
          {unfreezeError}
        </p>
      )}

      {canFreeze && !open && (
        <button type="button" onClick={() => setOpen(true)} className="btn text-sm">
          พักสมาชิก
        </button>
      )}
      {canFreeze && open && (
        <form action={formAction} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
          <label className="block">
            <span className="field-label">วันเริ่มพัก</span>
            <input type="date" name="start_date" defaultValue={today} min={today} required className="input" />
          </label>
          <label className="block">
            <span className="field-label">วันสิ้นสุด</span>
            <input type="date" name="end_date" required className="input" />
          </label>
          <label className="block">
            <span className="field-label">เหตุผล</span>
            <input name="reason" required className="input" />
          </label>
          {state.error && (
            <p role="alert" className="field-error sm:col-span-3">
              {state.error}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" disabled={pending} className="btn-primary">
              ยืนยันพัก
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn">
              ไม่พัก
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
