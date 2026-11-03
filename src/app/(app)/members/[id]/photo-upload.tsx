"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setMemberPhoto } from "../actions";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 512;

/** Shrink to at most 512px on the long side as JPEG, so uploads stay small. */
async function resize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

export function PhotoUpload({ memberId, name, photoUrl }: { memberId: string; name: string; photoUrl: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_BYTES) {
      setError("ไฟล์ต้องเป็นรูปภาพขนาดไม่เกิน 15MB");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await resize(file);
      const path = `${memberId}.jpg`;
      const { error: uploadError } = await createClient()
        .storage.from("member-photos")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const res = await setMemberPhoto(memberId);
      if (res.error) throw new Error(res.error);
      router.refresh();
    } catch {
      setError("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={photoUrl} alt={name} className="size-24 rounded-full object-cover ring-1 ring-slate-200" />
      ) : (
        <div className="flex size-24 items-center justify-center rounded-full bg-slate-200 text-4xl font-bold text-slate-600">
          {name.charAt(0)}
        </div>
      )}
      <div className="space-y-1">
        <label className="btn cursor-pointer">
          {busy ? "กำลังอัปโหลด…" : "ถ่ายหรือเลือกรูป"}
          <input
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
