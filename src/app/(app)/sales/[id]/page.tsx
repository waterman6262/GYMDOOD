import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt, type ReceiptData } from "@/components/receipt";
import { getCurrentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReceiptActions } from "./receipt-actions";
import { VoidForm } from "./void-form";

export default async function SaleReceiptPage({ params }: PageProps<"/sales/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: sale }, staff] = await Promise.all([
    supabase.from("sales").select("receipt_token, status, void_reason").eq("id", id).maybeSingle(),
    getCurrentStaff(),
  ]);
  if (!sale) notFound();

  const { data: receipt } = await supabase.rpc("get_receipt", { p_token: sale.receipt_token });
  if (!receipt) notFound();

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const shareUrl = `${proto}://${h.get("host")}/r/${sale.receipt_token}`;

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap gap-3">
        <Link href="/sell" className="btn-primary">
          ขายต่อ
        </Link>
        <ReceiptActions shareUrl={shareUrl} />
        <Link href="/sales" className="btn">
          รายการบิล
        </Link>
      </div>
      {sale.status === "voided" && sale.void_reason && (
        <p className="no-print text-sm text-red-700">เหตุผลที่ยกเลิก: {sale.void_reason}</p>
      )}
      <Receipt data={receipt as ReceiptData} />
      {staff?.role === "owner" && sale.status === "paid" && (
        <div className="no-print flex justify-center">
          <VoidForm saleId={id} />
        </div>
      )}
    </div>
  );
}
