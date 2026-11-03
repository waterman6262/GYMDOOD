"use client";

import generatePayload from "promptpay-qr";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { baht } from "@/lib/sales/format";

/** PromptPay QR for an exact amount, drawn as inline SVG. */
export function PromptPayQr({ promptpayId, amount }: { promptpayId: string; amount: number }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(generatePayload(promptpayId, { amount }), { type: "svg", margin: 1 }).then((s) => {
      if (!cancelled) setSvg(s);
    });
    return () => {
      cancelled = true;
    };
  }, [promptpayId, amount]);

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <div data-testid="promptpay-qr" className="size-56" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-lg font-semibold">{baht(amount)} บาท</p>
      <p className="text-sm text-slate-500">ให้ลูกค้าสแกนจ่าย แล้วตรวจยอดเข้าก่อนกด &quot;ได้รับเงินแล้ว&quot;</p>
    </div>
  );
}
