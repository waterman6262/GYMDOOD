"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/packages", label: "แพ็กเกจ" },
  { href: "/settings/staff", label: "พนักงาน" },
  { href: "/settings/shop", label: "ข้อมูลร้าน" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-2 border-b border-slate-200">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`-mb-px border-b-2 px-4 py-2 ${pathname.startsWith(tab.href) ? "border-indigo-600 font-semibold text-indigo-700" : "border-transparent text-slate-600"}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
