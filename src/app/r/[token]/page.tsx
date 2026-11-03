import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { Receipt, type ReceiptData } from "@/components/receipt";

// Public receipt link sent to members (e.g. over LINE). No login and no
// cookies: get_receipt returns only what is printed on the receipt.
export default async function PublicReceiptPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase.rpc("get_receipt", { p_token: token });
  if (!data) notFound();

  return (
    <main className="flex flex-1 justify-center p-4">
      <Receipt data={data as ReceiptData} />
    </main>
  );
}
