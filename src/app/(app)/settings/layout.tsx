import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const staff = await getCurrentStaff();
  if (staff?.role !== "owner") redirect("/");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ตั้งค่า</h1>
      <SettingsTabs />
      {children}
    </div>
  );
}
