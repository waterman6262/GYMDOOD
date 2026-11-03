begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- Fixtures -----------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'owner2@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'staff2@test.local');
insert into public.staff (user_id, name, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000b2', 'Staff', 'staff');

insert into public.members (id, name, phone, active) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ผู้ซื้อ หนึ่ง', '0899990001', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'มีแพ็กเกจ อยู่', '0899990002', true),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'ปิดใช้งาน แล้ว', '0899990003', false),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'คู่ ที่สอง', '0899990004', true),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'หมดอายุ แล้ว', '0899990005', true);

insert into public.package_types (id, name, kind, price, duration_days, visits, seats, active) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'รายเดือนทดสอบ', 'duration', 1200, 30, null, 1, true),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'คู่ทดสอบ', 'duration', 2000, 30, null, 2, true),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'ปิดขายทดสอบ', 'duration', 500, 30, null, 1, false),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'นับครั้งทดสอบ', 'visits', 900, 60, 10, 1, true);

insert into public.memberships (member_id, package_type_id, kind, start_date, end_date) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'duration', '2026-10-22', '2026-11-20'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000001', 'duration', '2026-09-02', '2026-10-01');

-- membership_dates ---------------------------------------------------------
select is(
  (select row(start_date, end_date)::text from public.membership_dates('aaaaaaaa-0000-0000-0000-000000000001', 'duration', 30, '2026-11-03')),
  '(2026-11-03,2026-12-02)', 'duration_starts_today');

select is(
  (select row(start_date, end_date)::text from public.membership_dates('aaaaaaaa-0000-0000-0000-000000000002', 'duration', 30, '2026-11-03')),
  '(2026-11-21,2026-12-20)', 'duration_stacks_after_current_end');

select is(
  (select row(start_date, end_date)::text from public.membership_dates('aaaaaaaa-0000-0000-0000-000000000005', 'duration', 30, '2026-11-03')),
  '(2026-11-03,2026-12-02)', 'expired_duration_does_not_stack');

select is(
  (select row(start_date, end_date)::text from public.membership_dates('aaaaaaaa-0000-0000-0000-000000000002', 'visits', 60, '2026-11-03')),
  '(2026-11-03,2027-01-01)', 'visits_start_today_even_if_stacked');

select is(
  (select row(start_date, end_date)::text from public.membership_dates('aaaaaaaa-0000-0000-0000-000000000001', 'day', 1, '2026-11-03')),
  '(2026-11-03,2026-11-03)', 'day_pass_is_one_day');

-- create_sale as staff -----------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';

select public.create_sale(
  'cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
  '[{"package_type_id":"bbbbbbbb-0000-0000-0000-000000000001","member_ids":["aaaaaaaa-0000-0000-0000-000000000001"]}]',
  0, 'cash') as sale1 \gset

select ok(
  (select total = 1200 from public.sales where id = (:'sale1'::jsonb ->> 'sale_id')::uuid)
  and (select count(*) = 1 and bool_and(kind = 'duration') from public.memberships m
       join public.sale_items si on si.id = m.sale_item_id
       where si.sale_id = (:'sale1'::jsonb ->> 'sale_id')::uuid),
  'staff_sells_monthly');

select matches(
  :'sale1'::jsonb ->> 'receipt_no',
  '^R' || extract(year from public.bangkok_today())::text || '-\d{6}$',
  'receipt_no_format');

select public.create_sale(
  'cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
  '[{"package_type_id":"bbbbbbbb-0000-0000-0000-000000000004","member_ids":["aaaaaaaa-0000-0000-0000-000000000001"]}]',
  0, 'transfer') as sale2 \gset

select is(
  right(:'sale2'::jsonb ->> 'receipt_no', 6)::int - right(:'sale1'::jsonb ->> 'receipt_no', 6)::int,
  1, 'receipt_numbers_consecutive');

select is(
  public.create_sale(
    'cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
    '[{"package_type_id":"bbbbbbbb-0000-0000-0000-000000000001","member_ids":["aaaaaaaa-0000-0000-0000-000000000001"]}]',
    0, 'cash') ->> 'sale_id',
  :'sale1'::jsonb ->> 'sale_id',
  'same_request_id_returns_same_sale');

select throws_ok(
  $$select public.create_sale('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
    '[{"package_type_id":"bbbbbbbb-0000-0000-0000-000000000004","member_ids":["aaaaaaaa-0000-0000-0000-000000000001"]}]',
    0, 'transfer')$$,
  'P0001', 'รายการนี้ถูกบันทึกไปแล้วด้วยข้อมูลอื่น กรุณาตรวจที่รายการบิลก่อนขายใหม่',
  'same_request_id_different_cart_rejected');

select public.create_sale(
  'cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
  '[{"package_type_id":"bbbbbbbb-0000-0000-0000-000000000002","member_ids":["aaaaaaaa-0000-0000-0000-000000000001","aaaaaaaa-0000-0000-0000-000000000004"]}]',
  0, 'cash') as sale3 \gset

select is(
  (select count(distinct m.member_id) from public.memberships m
   join public.sale_items si on si.id = m.sale_item_id
   where si.sale_id = (:'sale3'::jsonb ->> 'sale_id')::uuid),
  2::bigint, 'couple_creates_two_memberships');

select throws_ok(
  $$select public.create_sale('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
    '[{"package_type_id":"bbbbbbbb-0000-0000-0000-000000000002","member_ids":["aaaaaaaa-0000-0000-0000-000000000001","aaaaaaaa-0000-0000-0000-000000000001"]}]',
    0, 'cash')$$,
  'P0001', 'แพ็กเกจ "คู่ทดสอบ" ต้องเลือกสมาชิก 2 คนไม่ซ้ำกัน', 'couple_needs_two_distinct_members');

-- Separate statement: rows a function inserts aren't visible to the same query's snapshot.
select public.create_sale(
  'cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001',
  '[{"package_type_id":"bbbbbbbb-0000-0000-0000-000000000001","price":1,"member_ids":["aaaaaaaa-0000-0000-0000-000000000001"]}]',
  0, 'cash') as sale5 \gset

select is(
  (select total from public.sales where id = (:'sale5'::jsonb ->> 'sale_id')::uuid),
  1200.00::numeric, 'price_comes_from_database');

select throws_ok(
  $$select public.create_sale('cccccccc-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001',
    '[{"package_type_id":"bbbbbbbb-0000-0000-0000-000000000001","member_ids":["aaaaaaaa-0000-0000-0000-000000000001"]}]',
    5000, 'cash')$$,
  'P0001', 'ส่วนลดต้องอยู่ระหว่าง 0 ถึงยอดรวม', 'discount_over_subtotal_rejected');

select throws_ok(
  $$select public.create_sale('cccccccc-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001',
    '[{"package_type_id":"bbbbbbbb-0000-0000-0000-000000000003","member_ids":["aaaaaaaa-0000-0000-0000-000000000001"]}]',
    0, 'cash')$$,
  'P0001', 'แพ็กเกจ "ปิดขายทดสอบ" ปิดขายแล้ว', 'inactive_package_rejected');

select throws_ok(
  $$select public.create_sale('cccccccc-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000003',
    '[{"package_type_id":"bbbbbbbb-0000-0000-0000-000000000001","member_ids":["aaaaaaaa-0000-0000-0000-000000000003"]}]',
    0, 'cash')$$,
  'P0001', 'สมาชิกถูกปิดใช้งาน', 'inactive_member_rejected');

select throws_ok(
  $$select public.create_sale('cccccccc-0000-0000-0000-000000000009', null,
    '[{"package_type_id":"bbbbbbbb-0000-0000-0000-000000000001","member_ids":["aaaaaaaa-0000-0000-0000-000000000001"]}]',
    0, 'cash')$$,
  'P0001', 'กรุณาเลือกสมาชิก', 'buyer_required');

select throws_ok(
  $$insert into public.sales (receipt_no, subtotal, total, payment_method, client_request_id, request_hash)
    values ('X', 1, 1, 'cash', gen_random_uuid(), 'x')$$,
  '42501', null, 'staff_cannot_insert_sales_directly');

select throws_ok(
  format('select public.void_sale(%L, %L)', :'sale1'::jsonb ->> 'sale_id', 'ทดสอบ'),
  'P0001', 'เฉพาะเจ้าของเท่านั้นที่ยกเลิกบิลได้', 'staff_cannot_void');

-- void as owner ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select public.void_sale((:'sale1'::jsonb ->> 'sale_id')::uuid, 'ลูกค้าเปลี่ยนใจ');

select ok(
  (select status = 'voided' from public.sales where id = (:'sale1'::jsonb ->> 'sale_id')::uuid)
  and (select bool_and(m.status = 'cancelled') from public.memberships m
       join public.sale_items si on si.id = m.sale_item_id
       where si.sale_id = (:'sale1'::jsonb ->> 'sale_id')::uuid),
  'owner_void_cancels_memberships');

select throws_ok(
  format('select public.void_sale(%L, %L)', :'sale1'::jsonb ->> 'sale_id', 'อีกครั้ง'),
  'P0001', 'บิลนี้ถูกยกเลิกไปแล้ว', 'void_twice_rejected');

-- public receipt as anon ---------------------------------------------------
reset request.jwt.claims;
set local role anon;

select ok(
  (public.get_receipt(:'sale3'::jsonb ->> 'receipt_token') ->> 'member_name') = 'ผู้ซื้อ หนึ่ง'
  and position('0899990001' in public.get_receipt(:'sale3'::jsonb ->> 'receipt_token')::text) = 0,
  'anon_receipt_hides_phone');

select is(public.get_receipt('nope'), null, 'anon_receipt_unknown_token_null');

select * from finish();
rollback;
