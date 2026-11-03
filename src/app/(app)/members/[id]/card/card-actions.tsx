"use client";

import QRCode from "qrcode";

/** Print the card, or save it as a PNG to send to the member (e.g. over LINE). */
export function CardActions({ gymName, name, code }: { gymName: string; name: string; code: string }) {
  async function savePng() {
    const width = 856;
    const height = 540;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const font = getComputedStyle(document.body).fontFamily;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#4f46e5";
    ctx.fillRect(0, 0, width, 90);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 44px ${font}`;
    ctx.fillText(gymName || "MEMBER", 40, 62);

    const qr = new Image();
    qr.src = await QRCode.toDataURL(code, { margin: 1, width: 360 });
    await qr.decode();
    ctx.drawImage(qr, width - 400, 130, 360, 360);

    ctx.fillStyle = "#0f172a";
    ctx.font = `bold 40px ${font}`;
    ctx.fillText(name, 40, 220, width - 460);
    ctx.font = `36px monospace`;
    ctx.fillText(code, 40, 290);

    const link = document.createElement("a");
    link.download = `${code}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="no-print flex flex-wrap justify-center gap-3">
      <button type="button" onClick={() => window.print()} className="btn">
        พิมพ์บัตร
      </button>
      <button type="button" onClick={savePng} className="btn-primary">
        บันทึกรูป
      </button>
    </div>
  );
}
