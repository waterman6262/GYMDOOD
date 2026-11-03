"use client";

import { useState, useTransition } from "react";
import { MemberPicker } from "../../sell/member-picker";
import { bookMember, cancelBooking, markAttendance, type ClassActionState } from "../actions";

export type RosterEntry = { id: string; status: "booked" | "attended" | "no_show"; name: string; member_code: string };

const STATUS_LABELS = { booked: "จองแล้ว", attended: "มาแล้ว", no_show: "ไม่มา" } as const;
const STATUS_STYLES = {
  booked: "bg-sky-100 text-sky-800",
  attended: "bg-green-100 text-green-800",
  no_show: "bg-slate-200 text-slate-600",
} as const;

/** `open`: bookings can still be added. `cancelled`: the session was cancelled, so nothing can change. */
export function Roster({
  sessionId,
  entries,
  open,
  cancelled,
}: {
  sessionId: string;
  entries: RosterEntry[];
  open: boolean;
  cancelled: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ClassActionState>) =>
    startTransition(async () => {
      const res = await action();
      setError(res.error ?? null);
    });

  return (
    <div className="space-y-4">
      {open && !cancelled && (
        <div className="card space-y-2">
          <h2 className="font-semibold">จองให้สมาชิก</h2>
          <MemberPicker label="ค้นหาสมาชิกเพื่อจอง" onPick={(m) => run(() => bookMember(sessionId, m.id))} />
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      <ul data-testid="roster" className="divide-y divide-slate-200 rounded-2xl bg-white ring-1 ring-slate-200">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="font-medium">{e.name}</span>{" "}
              <span className="font-mono text-sm text-slate-500">{e.member_code}</span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {cancelled ? (
                <span className="rounded bg-red-100 px-2 py-0.5 text-sm text-red-700">ยกเลิก</span>
              ) : (
                <span className={`rounded px-2 py-0.5 text-sm ${STATUS_STYLES[e.status]}`}>{STATUS_LABELS[e.status]}</span>
              )}
              {!cancelled && e.status !== "attended" && (
                <button type="button" disabled={pending} onClick={() => run(() => markAttendance(e.id, true))} className="btn-primary">
                  มาแล้ว
                </button>
              )}
              {!cancelled && e.status === "booked" && (
                <>
                  <button type="button" disabled={pending} onClick={() => run(() => markAttendance(e.id, false))} className="btn">
                    ไม่มา
                  </button>
                  <button type="button" disabled={pending} onClick={() => run(() => cancelBooking(e.id))} className="btn-danger">
                    ยกเลิกจอง
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
        {entries.length === 0 && <li className="px-4 py-3 text-slate-400">ยังไม่มีคนจอง</li>}
      </ul>
    </div>
  );
}
