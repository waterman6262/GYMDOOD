import { getCurrentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LowFilter } from "./low-filter";
import { ProductForm, type ProductRowData } from "./product-form";
import { ProductRow } from "./product-row";

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const [{ low, edit }, staff] = await Promise.all([searchParams, getCurrentStaff()]);
  const isOwner = staff?.role === "owner";

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, price, track_stock, stock_qty, low_stock_at, active")
    .order("active", { ascending: false })
    .order("name");
  const all = (data ?? []) as ProductRowData[];
  const lowOnly = low === "1";
  // Running low = tracked and at or below its warning level (sold out included).
  const products = lowOnly ? all.filter((p) => p.active && p.track_stock && p.stock_qty <= p.low_stock_at) : all;
  const editing = isOwner ? all.find((p) => p.id === edit) : undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">สินค้าและสต็อก</h1>
      {isOwner && <ProductForm key={editing?.id ?? "new"} editing={editing} />}
      <LowFilter checked={lowOnly} />
      {products.length === 0 ? (
        <p className="text-slate-500">{lowOnly ? "ไม่มีสินค้าใกล้หมด" : "ยังไม่มีสินค้า"}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3">ชื่อ</th>
                <th className="px-4 py-3 text-right">ราคา</th>
                <th className="px-4 py-3">คงเหลือ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {products.map((p) => (
                <ProductRow key={p.id} product={p} isOwner={isOwner} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
