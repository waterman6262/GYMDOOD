import { requireOwnerPage } from "@/lib/auth";
import type { ShopSettings } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/server";
import { ShopForm } from "./shop-form";

export default async function ShopSettingsPage() {
  await requireOwnerPage();
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("gym_name, address, phone, promptpay_id, receipt_footer")
    .eq("id", 1)
    .single();

  return <ShopForm settings={data as ShopSettings} />;
}
