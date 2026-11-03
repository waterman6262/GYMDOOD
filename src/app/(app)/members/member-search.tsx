"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Search box + inactive filter that keep their state in the URL (?q=&inactive=1). */
export function MemberSearch({ q, inactive }: { q: string; inactive: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(q);
  const [showInactive, setShowInactive] = useState(inactive);

  useEffect(() => {
    if (text === q) return;
    const timer = setTimeout(() => navigate(text, showInactive), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function navigate(nextQ: string, nextInactive: boolean) {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextInactive) params.set("inactive", "1");
    router.replace(`${pathname}?${params}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <input
        type="search"
        aria-label="ค้นหาสมาชิก"
        placeholder="ค้นหาชื่อ เบอร์โทร หรือรหัสสมาชิก"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input max-w-md"
        autoFocus
      />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => {
            setShowInactive(e.target.checked);
            navigate(text, e.target.checked);
          }}
          className="size-5"
        />
        แสดงที่ปิดใช้งาน
      </label>
    </div>
  );
}
