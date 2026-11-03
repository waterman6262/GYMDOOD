"use client";

import { useEffect, useState } from "react";
import { findMembers, type MemberHit } from "./actions";

/** Search box whose results are buttons; picking one calls onPick and clears the box. */
export function MemberPicker({ label, onPick }: { label: string; onPick: (member: MemberHit) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);

  useEffect(() => {
    if (!q.trim()) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await findMembers(q);
      if (!cancelled) setHits(result);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const shown = q.trim() ? hits : [];

  return (
    <div className="space-y-2">
      <input
        type="search"
        aria-label={label}
        placeholder={`${label} (ชื่อ เบอร์ หรือรหัส)`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="input"
      />
      {shown.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-lg ring-1 ring-slate-200">
          {shown.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                aria-label={`เลือก ${m.name}`}
                onClick={() => {
                  onPick(m);
                  setQ("");
                  setHits([]);
                }}
                className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
              >
                <span>{m.name}</span>
                <span className="text-sm text-slate-500">
                  {m.member_code}
                  {m.phone && ` · ${m.phone}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
