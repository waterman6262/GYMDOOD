"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LowFilter({ checked }: { checked: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(checked);

  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setOn(e.target.checked);
          router.replace(e.target.checked ? "/products?low=1" : "/products");
        }}
        className="size-5"
      />
      แสดงเฉพาะใกล้หมด
    </label>
  );
}
