"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { DENY_REASON_LABELS, type CheckInResult } from "@/lib/checkin/types";
import { formatThaiDate } from "@/lib/sales/format";
import type { MemberHit } from "../sell/actions";
import { checkInMember, findForCheckIn } from "./actions";
import { useOnline } from "@/components/online-status";
import { CameraScanner } from "./camera-scanner";

export type TodayCheckIn = { id: string; time: string; name: string; override: boolean };

const STATUS_STYLES = {
  ok: { box: "bg-green-50 ring-green-300", badge: "bg-green-600", label: "เข้าได้" },
  warning: { box: "bg-amber-50 ring-amber-300", badge: "bg-amber-500", label: "ใกล้หมด" },
  denied: { box: "bg-red-50 ring-red-300", badge: "bg-red-600", label: "เข้าไม่ได้" },
} as const;

export function CheckInScreen({ today }: { today: TodayCheckIn[] }) {
  const router = useRouter();
  const online = useOnline();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const refocus = () => setTimeout(() => inputRef.current?.focus(), 0);

  const runCheckIn = useCallback(
    async (memberId: string, reason?: string) => {
      if (!navigator.onLine) {
        setError("ออฟไลน์อยู่ ยังเช็กอินไม่ได้");
        return;
      }
      setBusy(true);
      setError(null);
      const res = await checkInMember(memberId, reason).catch(() => ({
        error: "เช็กอินไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่",
      }));
      setBusy(false);
      if ("error" in res) {
        setError(res.error);
      } else {
        setResult(res);
        setHits([]);
        if (!reason) {
          setOverrideOpen(false);
          setOverrideReason("");
        }
        router.refresh();
      }
      setText("");
      refocus();
    },
    [router],
  );

  const lookup = useCallback(
    async (value: string) => {
      if (!value.trim()) return;
      if (!navigator.onLine) {
        setError("ออฟไลน์อยู่ ยังเช็กอินไม่ได้");
        return;
      }
      setBusy(true);
      setError(null);
      const found = await findForCheckIn(value).catch(() => null);
      setBusy(false);
      if (!found) {
        setError("เช็กอินไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่");
        return;
      }
      if (found.exact) return runCheckIn(found.exact.id);
      setResult(null);
      setHits(found.hits);
      if (found.hits.length === 0) setError("ไม่พบสมาชิก");
    },
    [runCheckIn],
  );

  const onCameraCode = useCallback(
    (code: string) => {
      setCamera(false);
      lookup(code);
    },
    [lookup],
  );

  async function confirmOverride() {
    if (!result) return;
    if (!overrideReason.trim()) return setOverrideError("กรุณาระบุเหตุผล");
    setOverrideError(null);
    await runCheckIn(result.member.id, overrideReason.trim());
  }

  const style = result ? STATUS_STYLES[result.status] : null;
  const overridden = result?.status === "denied" && result.check_in_id !== null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(text);
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            aria-label="สแกนหรือค้นหาสมาชิก"
            placeholder="สแกน QR หรือพิมพ์ชื่อ / เบอร์ / รหัส แล้วกด Enter"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            autoComplete="off"
            className="input py-4 text-xl"
          />
          <button type="button" onClick={() => setCamera((c) => !c)} className="btn shrink-0">
            สแกนด้วยกล้อง
          </button>
        </form>

        {camera && <CameraScanner onCode={onCameraCode} onClose={() => setCamera(false)} />}
        {busy && <p className="text-slate-500">กำลังตรวจสอบ…</p>}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
            {error}
          </p>
        )}

        {hits.length > 0 && (
          <ul className="divide-y divide-slate-200 rounded-2xl bg-white ring-1 ring-slate-200">
            {hits.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-label={`เช็กอิน ${m.name}`}
                  onClick={() => runCheckIn(m.id)}
                  className="flex min-h-14 w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-sm text-slate-500">
                    {m.member_code}
                    {m.phone && ` · ${m.phone}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {result && style && (
          <div data-testid="checkin-result" data-status={result.status} className={`space-y-4 rounded-2xl p-6 ring-2 ${style.box}`}>
            <div className="flex items-center gap-4">
              {result.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img src={result.photo_url} alt={result.member.name} className="size-24 rounded-full object-cover" />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-full bg-slate-200 text-4xl font-bold text-slate-600">
                  {result.member.name.charAt(0)}
                </div>
              )}
              <div className="space-y-1">
                <span className={`inline-block rounded-full px-4 py-1 text-lg font-bold text-white ${style.badge}`}>
                  {style.label}
                </span>
                <p className="text-2xl font-bold">{result.member.name}</p>
                <p className="font-mono text-slate-500">{result.member.member_code}</p>
              </div>
            </div>

            <div className="space-y-1 text-lg">
              {result.status === "denied" && result.reason && (
                <p className="font-semibold text-red-700">{DENY_REASON_LABELS[result.reason]}</p>
              )}
              {result.membership && (
                <p>
                  {result.membership.package_name} · หมดอายุ {formatThaiDate(result.membership.end_date)}
                  {result.membership.kind === "visits" && ` · เหลือ ${result.membership.visits_left} ครั้ง`}
                </p>
              )}
              {result.next_start_date && <p>แพ็กเกจถัดไปเริ่ม {formatThaiDate(result.next_start_date)}</p>}
              {result.already_today && <p className="text-slate-600">เข้าแล้ววันนี้</p>}
              {overridden && <p className="font-semibold text-slate-800">ปล่อยเข้าแล้ว</p>}
            </div>

            {result.status !== "ok" && (
              <div className="flex flex-wrap gap-3">
                <Link href={`/sell?member=${result.member.id}`} className="btn-primary">
                  ต่ออายุ
                </Link>
                {result.status === "denied" && !overridden && !overrideOpen && (
                  <button type="button" onClick={() => setOverrideOpen(true)} className="btn">
                    ปล่อยเข้าครั้งนี้
                  </button>
                )}
              </div>
            )}

            {result.status === "denied" && !overridden && overrideOpen && (
              <div className="space-y-2">
                <label className="block">
                  <span className="field-label">เหตุผลที่ปล่อยเข้า</span>
                  <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className="input" />
                </label>
                {overrideError && (
                  <p role="alert" className="field-error">
                    {overrideError}
                  </p>
                )}
                <button type="button" onClick={confirmOverride} disabled={busy || !online} className="btn-danger">
                  ยืนยันปล่อยเข้า
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="card h-fit space-y-3">
        <h2 className="font-semibold">
          เช็กอินวันนี้ <span className="text-slate-500">({today.length})</span>
        </h2>
        <ul data-testid="today-checkins" className="divide-y divide-slate-100 text-sm">
          {today.slice(0, 20).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                <span className="text-slate-500">{c.time}</span> {c.name}
              </span>
              {c.override && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">ปล่อยเข้า</span>}
            </li>
          ))}
          {today.length === 0 && <li className="py-2 text-slate-400">ยังไม่มีใครเช็กอิน</li>}
        </ul>
      </aside>
    </div>
  );
}
