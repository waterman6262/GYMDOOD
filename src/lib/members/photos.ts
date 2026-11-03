import "server-only";
import { createClient } from "@/lib/supabase/server";

export const PHOTO_BUCKET = "member-photos";

/** Short-lived signed URLs for private member photos, keyed by storage path. */
export async function getPhotoUrls(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const wanted = paths.filter((p): p is string => !!p);
  if (wanted.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(wanted, 3600);
  const urls: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
  return urls;
}
