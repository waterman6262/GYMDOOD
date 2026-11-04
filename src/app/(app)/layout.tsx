import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { OfflineBanner } from "@/components/online-status";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const staff = await getCurrentStaff();
  // Signed in but not an active staff member (e.g. deactivated by the owner).
  if (!staff) redirect("/login?inactive=1");

  return (
    <>
    <OfflineBanner />
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 bg-slate-900 p-4 text-slate-100 md:w-56">
        <div>
          <p className="text-lg font-bold">GYMDOOD</p>
          <p className="text-sm text-slate-400">
            {staff.name} · {staff.role === "owner" ? "เจ้าของ" : "พนักงาน"}
          </p>
        </div>
        <NavLinks isOwner={staff.role === "owner"} />
        <form action={signOut} className="md:mt-auto">
          <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-slate-800">
            ออกจากระบบ
          </button>
        </form>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
    </>
  );
}
