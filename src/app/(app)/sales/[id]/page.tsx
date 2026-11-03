import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt, type ReceiptData } from "@/components/receipt";
import { createClient } from "@/lib/supabase/server";

export default async function SaleReceiptPage({ params }: PageProps<"/sales/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: sale } = await supabase.from("sales").select("receipt_token").eq("id", id).maybeSingle();
  if (!sale) notFound();

  const { data: receipt } = await supabase.rpc("get_receipt", { p_token: sale.receipt_token });
  if (!receipt) notFound();

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap gap-3">
        <Link href="/sell" className="btn-primary">
          ขายต่อ
        </Link>
      </div>
      <Receipt data={receipt as ReceiptData} />
    </div>
  );
}
