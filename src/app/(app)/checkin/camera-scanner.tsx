"use client";

import { useEffect, useRef, useState } from "react";

/** Live camera view that reports the first QR code it reads, then stops. */
export function CameraScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let scanner: { start: () => Promise<void>; stop: () => void; destroy: () => void } | null = null;
    let done = false;

    (async () => {
      const { default: QrScanner } = await import("qr-scanner");
      if (!videoRef.current || done) return;
      const instance = new QrScanner(
        videoRef.current,
        (result) => {
          if (done) return;
          done = true;
          instance.stop();
          onCode(result.data);
        },
        { preferredCamera: "environment", highlightScanRegion: true, returnDetailedScanResult: true },
      );
      scanner = instance;
      try {
        await instance.start();
      } catch {
        setError("เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง หรือค้นหาด้วยชื่อแทน");
      }
    })();

    return () => {
      done = true;
      scanner?.destroy();
    };
  }, [onCode]);

  return (
    <div className="space-y-3 rounded-2xl bg-slate-900 p-4 text-white">
      {error ? (
        <p role="alert" className="text-amber-300">
          {error}
        </p>
      ) : (
        <video ref={videoRef} className="mx-auto aspect-square w-full max-w-sm rounded-xl object-cover" muted playsInline />
      )}
      <button type="button" onClick={onClose} className="btn w-full">
        ปิดกล้อง
      </button>
    </div>
  );
}
