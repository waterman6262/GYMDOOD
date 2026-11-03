import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { STAFF } from "./helpers";

// Talks to the local Supabase directly to exercise create_sale under real
// concurrency, which the browser UI's own double-submit guard would hide.
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

test("concurrent_same_request_id_returns_one_sale", async () => {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await supabase.auth.signInWithPassword(STAFF);

  const { data: member } = await supabase.from("members").select("id").eq("member_code", "A1000002").single();
  const { data: pkg } = await supabase.from("package_types").select("id").eq("name", "รายวัน").single();

  // Several rounds: a race only shows up when both calls overlap.
  for (let round = 0; round < 5; round++) {
    const args = {
      p_client_request_id: crypto.randomUUID(),
      p_member_id: member!.id,
      p_items: [{ package_type_id: pkg!.id, member_ids: [member!.id] }],
      p_discount: 0,
      p_payment_method: "cash",
    };
    const results = await Promise.all([supabase.rpc("create_sale", args), supabase.rpc("create_sale", args)]);
    for (const r of results) expect(r.error).toBeNull();
    expect(results[0].data.sale_id).toBe(results[1].data.sale_id);
  }
});
