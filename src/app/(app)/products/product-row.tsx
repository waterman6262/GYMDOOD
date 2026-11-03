"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { baht } from "@/lib/sales/format";
import { adjustStock, receiveStock, setProductActive, type ProductFormState } from "./actions";
import type { ProductRowData } from "./product-form";

type Mode = "none" | "receive" | "adjust";

export function ProductRow({ product, isOwner }: { product: ProductRowData; isOwner: boolean }) {
  const [mode, setMode] = useState<Mode>("none");
  const close = (res: ProductFormState) => {
    if (!res.error) setMode("none");
    return res;
  };
  const [receiveState, receiveAction, receiving] = useActionState<ProductFormState, FormData>(
    async (prev, fd) => close(await receiveStock(product.id, prev, fd)),
    {},
  );
  const [adjustState, adjustAction, adjusting] = useActionState<ProductFormState, FormData>(
    async (prev, fd) => close(await adjustStock(product.id, prev, fd)),
    {},
  );
  const [toggling, startToggle] = useTransition();

  const out = product.track_stock && product.stock_qty <= 0;
  const low = product.track_stock && !out && product.stock_qty <= product.low_stock_at;

  return (
    <tr className={product.active ? "" : "text-slate-400"}>
      <td className="px-4 py-3 align-top">
        <Link href={`/products/${product.id}`} className="font-medium text-indigo-700 hover:underline">
          {product.name}
        </Link>
        {!product.active && <span className="ml-2 text-xs">(ปิดขาย)</span>}
      </td>
      <td className="px-4 py-3 text-right align-top">{baht(product.price)}</td>
      <td className="px-4 py-3 align-top">
        {product.track_stock ? (
          <span className="flex items-center gap-2">
            <span data-testid="stock-qty" className="font-semibold">
              {product.stock_qty}
            </span>
            {out && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">หมด</span>}
            {low && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">ใกล้หมด</span>}
          </span>
        ) : (
          <span className="text-sm text-slate-500">ไม่นับสต็อก</span>
        )}
      </td>
      <td className="space-y-2 px-4 py-2 align-top">
        <div className="flex flex-wrap justify-end gap-2">
          {product.track_stock && (
            <button type="button" onClick={() => setMode(mode === "receive" ? "none" : "receive")} className="btn">
              รับเข้า
            </button>
          )}
          {isOwner && product.track_stock && (
            <button type="button" onClick={() => setMode(mode === "adjust" ? "none" : "adjust")} className="btn">
              ปรับยอด
            </button>
          )}
          {isOwner && (
            <>
              <Link href={`/products?edit=${product.id}`} className="btn">
                แก้ไข
              </Link>
              <button
                type="button"
                disabled={toggling}
                onClick={() => startToggle(async () => void (await setProductActive(product.id, !product.active)))}
                className="btn"
              >
                {product.active ? "ปิดขาย" : "เปิดขาย"}
              </button>
            </>
          )}
        </div>

        {mode === "receive" && (
          <form action={receiveAction} className="flex flex-wrap items-end justify-end gap-2">
            <label className="block w-28">
              <span className="field-label">จำนวนรับเข้า</span>
              <input name="qty" type="number" min={1} step={1} required className="input" autoFocus />
            </label>
            <label className="block w-48">
              <span className="field-label">หมายเหตุ</span>
              <input name="note" className="input" />
            </label>
            <button type="submit" disabled={receiving} className="btn-primary">
              บันทึกรับเข้า
            </button>
            {receiveState.error && (
              <p role="alert" className="field-error w-full text-right">
                {receiveState.error}
              </p>
            )}
          </form>
        )}

        {mode === "adjust" && (
          <form action={adjustAction} className="flex flex-wrap items-end justify-end gap-2">
            <label className="block w-28">
              <span className="field-label">จำนวนที่นับได้</span>
              <input name="counted" type="number" min={0} step={1} required className="input" autoFocus />
            </label>
            <label className="block w-48">
              <span className="field-label">เหตุผล</span>
              <input name="note" required className="input" />
            </label>
            <button type="submit" disabled={adjusting} className="btn-primary">
              บันทึกยอด
            </button>
            {adjustState.error && (
              <p role="alert" className="field-error w-full text-right">
                {adjustState.error}
              </p>
            )}
          </form>
        )}
      </td>
    </tr>
  );
}
