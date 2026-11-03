import { createClient } from "@/lib/supabase/server";
import { CheckInScreen, type TodayCheckIn } from "./checkin/check-in-screen";

const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

// Home screen: check-in (spec §4 screen 1).
export default async function CheckInPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("check_ins")
    .select("id, checked_in_at, override, members(name)")
    .eq("check_in_date", bangkokToday())
    .order("checked_in_at", { ascending: false });

  const today: TodayCheckIn[] = (data ?? []).map((c) => ({
    id: c.id,
    time: timeFormat.format(new Date(c.checked_in_at)),
    name: (c.members as unknown as { name: string } | null)?.name ?? "",
    override: c.override,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">เช็กอิน</h1>
      <CheckInScreen today={today} />
    </div>
  );
}
