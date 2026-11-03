import Link from "next/link";
import { getMember } from "@/lib/members/queries";
import { createClient } from "@/lib/supabase/server";
import { SellScreen, type SellPackage } from "./sell-screen";

const KIND_ORDER = { day: 0, duration: 1, visits: 2, pt: 3 } as const;

export default async function SellPage({ searchParams }: PageProps<"/sell">) {
  const { member } = await searchParams;
  const supabase = await createClient();

  const [{ data: packages }, { data: settings }, buyer] = await Promise.all([
    supabase.from("package_types").select("id, name, kind, price, seats, tag").eq("active", true).order("price"),
    supabase.from("settings").select("promptpay_id").eq("id", 1).single(),
    typeof member === "string" ? getMember(member) : Promise.resolve(null),
  ]);

  const sorted = ((packages ?? []) as SellPackage[]).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">ขาย</h1>
        <Link href="/sales" className="btn">
          บิลวันนี้
        </Link>
      </div>
      <SellScreen
        packages={sorted}
        promptpayId={settings?.promptpay_id ?? ""}
        initialBuyer={buyer?.active ? { id: buyer.id, name: buyer.name, member_code: buyer.member_code } : null}
      />
    </div>
  );
}
