begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Fixtures -----------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'owner4@test.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'staff4@test.local');
insert into public.staff (user_id, name, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000d2', 'Staff', 'staff');

insert into public.members (id, name) values ('99999999-0000-0000-0000-000000000001', 'ลูกค้า สินค้า');
insert into public.package_types (id, name, kind, price, duration_days)
  values ('99999999-0000-0000-0000-0000000000a1', 'รายวันสินค้า', 'day', 100, 1);

insert into public.products (id, name, price, track_stock, stock_qty, low_stock_at, active) values
  ('99999999-0000-0000-0000-0000000000f1', 'A', 10, true, 5, 2, true),
  ('99999999-0000-0000-0000-0000000000f2', 'B', 20, false, 0, 0, true),
  ('99999999-0000-0000-0000-0000000000f3', 'C', 30, true, 10, 2, false);

-- As staff -----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';

select public.create_sale('77777777-0000-0000-0000-000000000001', null,
  '[{"product_id":"99999999-0000-0000-0000-0000000000f1","qty":2}]', 0, 'cash') as s1 \gset

select ok(
  (select total = 20 from public.sales where id = (:'s1'::jsonb ->> 'sale_id')::uuid)
  and (select stock_qty = 3 from public.products where id = '99999999-0000-0000-0000-0000000000f1')
  and exists (select 1 from public.stock_movements where sale_id = (:'s1'::jsonb ->> 'sale_id')::uuid
              and reason = 'sale' and change = -2),
  'sell_product_without_member');

select public.create_sale('77777777-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001',
  '[{"package_type_id":"99999999-0000-0000-0000-0000000000a1","member_ids":["99999999-0000-0000-0000-000000000001"]},
    {"product_id":"99999999-0000-0000-0000-0000000000f1","qty":1}]', 0, 'cash') as s2 \gset

select ok(
  (select count(*) = 2 and count(*) filter (where item_type = 'package') = 1
   from public.sale_items where sale_id = (:'s2'::jsonb ->> 'sale_id')::uuid)
  and (select count(*) = 1 from public.memberships m join public.sale_items i on i.id = m.sale_item_id
       where i.sale_id = (:'s2'::jsonb ->> 'sale_id')::uuid)
  and (select stock_qty = 2 from public.products where id = '99999999-0000-0000-0000-0000000000f1'),
  'mixed_cart');

select throws_ok(
  $$select public.create_sale('77777777-0000-0000-0000-000000000003', null,
    '[{"package_type_id":"99999999-0000-0000-0000-0000000000a1","member_ids":["99999999-0000-0000-0000-000000000001"]}]', 0, 'cash')$$,
  'P0001', 'กรุณาเลือกสมาชิก', 'package_still_needs_member');

select count(*) as sales_before from public.sales \gset
select throws_ok(
  $$select public.create_sale('77777777-0000-0000-0000-000000000004', null,
    '[{"product_id":"99999999-0000-0000-0000-0000000000f1","qty":5}]', 0, 'cash')$$,
  'P0001', 'สินค้า "A" เหลือไม่พอ (เหลือ 2)', 'insufficient_stock_rejected');
select is((select count(*) from public.sales), :'sales_before'::bigint, 'insufficient_stock_saves_nothing');

select throws_ok(
  $$select public.create_sale('77777777-0000-0000-0000-000000000005', null,
    '[{"product_id":"99999999-0000-0000-0000-0000000000f1","qty":1},{"product_id":"99999999-0000-0000-0000-0000000000f1","qty":2}]', 0, 'cash')$$,
  'P0001', 'สินค้า "A" เหลือไม่พอ (เหลือ 2)', 'same_product_two_lines_counted_together');

select public.create_sale('77777777-0000-0000-0000-000000000006', null,
  '[{"product_id":"99999999-0000-0000-0000-0000000000f2","qty":100}]', 0, 'cash') as s6 \gset
select ok(
  (select total = 2000 from public.sales where id = (:'s6'::jsonb ->> 'sale_id')::uuid)
  and (select stock_qty = 0 from public.products where id = '99999999-0000-0000-0000-0000000000f2')
  and not exists (select 1 from public.stock_movements where product_id = '99999999-0000-0000-0000-0000000000f2'),
  'untracked_product_unlimited');

select throws_ok(
  $$select public.create_sale('77777777-0000-0000-0000-000000000007', null,
    '[{"product_id":"99999999-0000-0000-0000-0000000000f3","qty":1}]', 0, 'cash')$$,
  'P0001', 'สินค้า "C" ปิดขายแล้ว', 'inactive_product_rejected');

select throws_ok(
  $$select public.create_sale('77777777-0000-0000-0000-000000000008', null,
    '[{"product_id":"99999999-0000-0000-0000-0000000000f1","qty":0}]', 0, 'cash')$$,
  'P0001', 'จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 1', 'qty_zero_rejected');
select throws_ok(
  $$select public.create_sale('77777777-0000-0000-0000-000000000009', null,
    '[{"product_id":"99999999-0000-0000-0000-0000000000f1","qty":1.5}]', 0, 'cash')$$,
  'P0001', 'จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 1', 'qty_fraction_rejected');

select ok(
  public.receive_stock('99999999-0000-0000-0000-0000000000f1', 10, 'ล็อตใหม่') = 12
  , 'staff_receives_stock');
select throws_ok($$select public.receive_stock('99999999-0000-0000-0000-0000000000f1', 0, 'x')$$,
  'P0001', 'จำนวนรับเข้าต้องมากกว่า 0', 'receive_nonpositive_rejected');
select throws_ok($$select public.receive_stock('99999999-0000-0000-0000-0000000000f2', 5, 'x')$$,
  'P0001', 'สินค้านี้ไม่ได้นับสต็อก', 'receive_untracked_rejected');
select throws_ok($$select public.adjust_stock('99999999-0000-0000-0000-0000000000f1', 1, 'x')$$,
  'P0001', 'เฉพาะเจ้าของเท่านั้นที่ปรับยอดสต็อกได้', 'staff_cannot_adjust');
select is_empty($$update public.products set price = 1 returning id$$, 'staff_cannot_edit_price');
select throws_ok($$insert into public.products (name, price) values ('X', 1)$$, '42501', null, 'staff_cannot_insert_products');

-- As owner -----------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select public.void_sale((:'s1'::jsonb ->> 'sale_id')::uuid, 'คืนของ');
select ok(
  (select stock_qty = 14 from public.products where id = '99999999-0000-0000-0000-0000000000f1')
  and exists (select 1 from public.stock_movements where sale_id = (:'s1'::jsonb ->> 'sale_id')::uuid
              and reason = 'void' and change = 2),
  'void_after_receive_adds_back');

-- Separate statement: rows a function inserts aren't visible to the same query's snapshot.
select public.adjust_stock('99999999-0000-0000-0000-0000000000f1', 9, 'นับจริง') as adjusted \gset
select ok(
  :adjusted = 9
  and (select stock_qty = 9 from public.products where id = '99999999-0000-0000-0000-0000000000f1')
  and exists (select 1 from public.stock_movements where product_id = '99999999-0000-0000-0000-0000000000f1'
              and reason = 'adjust' and change = -5),
  'owner_adjust_records_difference');

select count(*) as moves_before from public.stock_movements \gset
select public.adjust_stock('99999999-0000-0000-0000-0000000000f1', 9, 'นับซ้ำ');
select is((select count(*) from public.stock_movements), :'moves_before'::bigint, 'adjust_same_count_no_movement');

select throws_ok($$update public.products set stock_qty = 100$$, '42501', null, 'owner_cannot_update_stock_directly');
select isnt_empty($$update public.products set price = 12 where name = 'A' returning id$$, 'owner_can_edit_price');

select * from finish();
rollback;
