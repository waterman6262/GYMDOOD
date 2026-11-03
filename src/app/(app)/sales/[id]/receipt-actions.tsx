"use client";

import { useState } from "react";

export function ReceiptActions({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button type="button" onClick={() => window.print()} className="btn">
        พิมพ์
      </button>
      <button type="button" onClick={copy} data-share-url={shareUrl} className="btn">
        คัดลอกลิงก์ใบเสร็จ
      </button>
      {copied && <span className="self-center text-sm text-green-700">คัดลอกแล้ว ส่งทาง LINE ได้เลย</span>}
    </>
  );
}
