import { expect, test } from "@playwright/test";
import { ownerClient, staffClient } from "./supabase-client";

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

test("concurrent_last_item_sells_once", async () => {
  const owner = await ownerClient();
  const staff = await staffClient();
  const { data: product, error } = await owner
    .from("products")
    .insert({ name: `ชิ้นสุดท้าย ${Date.now()}`, price: 10 })
    .select("id")
    .single();
  expect(error).toBeNull();
  await staff.rpc("receive_stock", { p_product_id: product!.id, p_qty: 1, p_note: "ทดสอบ" });

  const sell = () =>
    staff.rpc("create_sale", {
      p_client_request_id: crypto.randomUUID(),
      p_member_id: null,
      p_items: [{ product_id: product!.id, qty: 1 }],
      p_discount: 0,
      p_payment_method: "cash",
    });
  const results = await Promise.all([sell(), sell()]);

  expect(results.filter((r) => !r.error)).toHaveLength(1);
  const failed = results.find((r) => r.error)!;
  expect(failed.error!.message).toMatch(/^สินค้า ".*" เหลือไม่พอ/);
  const { data: after } = await staff.from("products").select("stock_qty").eq("id", product!.id).single();
  expect(after!.stock_qty).toBe(0);
});

test("concurrent_last_seat_books_once", async () => {
  const owner = await ownerClient();
  const staff = await staffClient();
  const { data: type } = await owner.from("class_types").select("id").eq("name", "โยคะ").single();
  const start = new Date(Date.now() + 24 * 3600_000);
  const { data: session, error } = await owner
    .from("class_sessions")
    .insert({
      class_type_id: type!.id,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 3600_000).toISOString(),
      capacity: 1,
    })
    .select("id")
    .single();
  expect(error).toBeNull();

  const { data: pkg } = await staff.from("package_types").select("id").eq("name", "รายเดือน").single();
  const memberIds: string[] = [];
  for (const n of [1, 2]) {
    const { data: m } = await staff.from("members").insert({ name: `ที่นั่งสุดท้าย ${n} ${Date.now()}` }).select("id").single();
    const sale = await staff.rpc("create_sale", {
      p_client_request_id: crypto.randomUUID(),
      p_member_id: m!.id,
      p_items: [{ package_type_id: pkg!.id, member_ids: [m!.id] }],
      p_discount: 0,
      p_payment_method: "cash",
    });
    expect(sale.error).toBeNull();
    memberIds.push(m!.id);
  }

  const results = await Promise.all(
    memberIds.map((id) => staff.rpc("book_class", { p_session_id: session!.id, p_member_id: id })),
  );
  expect(results.filter((r) => !r.error)).toHaveLength(1);
  expect(results.find((r) => r.error)!.error!.message).toBe("คลาสเต็มแล้ว");
  const { count } = await staff
    .from("class_bookings")
    .select("id", { count: "exact", head: true })
    .eq("class_session_id", session!.id)
    .neq("status", "cancelled");
  expect(count).toBe(1);
});
