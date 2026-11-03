"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; ready: boolean; ownerOnly?: boolean };

// Screens from spec §4. `ready: false` items arrive in later plans.
const NAV: NavItem[] = [
  { href: "/", label: "เช็กอิน", ready: false },
  { href: "/sell", label: "ขาย", ready: false },
  { href: "/members", label: "สมาชิก", ready: true },
  { href: "/classes", label: "คลาส/PT", ready: false },
  { href: "/products", label: "สินค้า", ready: false },
  { href: "/reports", label: "รายงาน", ready: false },
  { href: "/settings/packages", label: "ตั้งค่า", ready: true, ownerOnly: true },
];

export function NavLinks({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 md:flex-col">
      {NAV.filter((item) => !item.ownerOnly || isOwner).map((item) => {
        if (!item.ready) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-slate-500"
            >
              {item.label}
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">เร็ว ๆ นี้</span>
            </span>
          );
        }
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.split("/").slice(0, 2).join("/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-11 items-center rounded-lg px-3 py-2 ${active ? "bg-indigo-600 text-white" : "hover:bg-slate-800"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
