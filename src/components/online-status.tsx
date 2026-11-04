"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the browser thinks it is online. Assumed online during server render. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Spec §8: say plainly that nothing can be saved while offline. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-50 bg-red-600 px-4 py-2 text-center text-white">
      <p className="font-bold">ออฟไลน์ — ยังไม่ได้บันทึก</p>
      <p className="text-sm">ตรวจ Wi-Fi หรือเน็ตมือถือ ระบบจะใช้งานได้เองเมื่อกลับมาออนไลน์</p>
    </div>
  );
}
