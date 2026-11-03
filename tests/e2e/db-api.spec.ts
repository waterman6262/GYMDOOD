import { expect, test } from "@playwright/test";
import { staffClient } from "./supabase-client";

test("concurrent_same_request_id_returns_one_sale", async () => {
  const supabase = await staffClient();
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

test("concurrent_scans_deduct_once", async () => {
  const supabase = await staffClient();
  const { data: member } = await supabase
    .from("members")
    .insert({ name: `สแกนพร้อมกัน ${Date.now()}` })
    .select("id")
    .single();
  const { data: pkg } = await supabase.from("package_types").select("id").eq("name", "10 ครั้ง").single();
  const sale = await supabase.rpc("create_sale", {
    p_client_request_id: crypto.randomUUID(),
    p_member_id: member!.id,
    p_items: [{ package_type_id: pkg!.id, member_ids: [member!.id] }],
    p_discount: 0,
    p_payment_method: "cash",
  });
  expect(sale.error).toBeNull();

  const scans = await Promise.all(
    Array.from({ length: 4 }, () => supabase.rpc("check_in", { p_member_id: member!.id })),
  );
  for (const s of scans) expect(s.error).toBeNull();

  const { data: ms } = await supabase.from("memberships").select("visits_left").eq("member_id", member!.id).single();
  expect(ms!.visits_left).toBe(9);
  const { count } = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("member_id", member!.id)
    .eq("visit_deducted", true);
  expect(count).toBe(1);
});
