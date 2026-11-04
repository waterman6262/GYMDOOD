begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select public.bangkok_today() as today \gset

-- Fixtures -----------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner6@test.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'staff6@test.local');
insert into public.staff (id, user_id, name, role) values
  ('20202020-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'Owner', 'owner'),
  ('20202020-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f2', 'Staff', 'staff');

-- members 21212121-...-NN
insert into public.members (id, name, phone)
select ('21212121-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'รายงาน ' || n, '0890000' || lpad(n::text, 3, '0')
from generate_series(1, 20) n;

insert into public.package_types (id, name, kind, price, duration_days, visits, pt_sessions) values
  ('22222222-0000-0000-0000-000000000001', 'เดือนรายงาน', 'duration', 1200, 30, null, null),
  ('22222222-0000-0000-0000-000000000002', 'ครั้งรายงาน', 'visits', 900, 60, 10, null),
  ('22222222-0000-0000-0000-000000000003', 'PTรายงาน', 'pt', 6000, 90, null, 10);

insert into public.products (id, name, price, track_stock, stock_qty, low_stock_at) values
  ('23232323-0000-0000-0000-000000000001', 'น้ำรายงาน', 10, true, 50, 5),
  ('23232323-0000-0000-0000-000000000002', 'เวย์รายงาน', 60, true, 50, 5),
  ('23232323-0000-0000-0000-000000000003', 'ใกล้หมดรายงาน', 25, true, 1, 5);

-- Sales on 2030-01-10/11 (Bangkok). s4 is voided. s5 is 23:30 and s6 is 00:30 the next day, Bangkok time.
insert into public.sales (id, receipt_no, member_id, subtotal, discount, total, payment_method, status, client_request_id, request_hash, created_at) values
  ('24242424-0000-0000-0000-000000000001', 'RT-1', null, 1200, 0, 1200, 'cash', 'paid', gen_random_uuid(), 'x', '2030-01-10 03:00+00'),
  ('24242424-0000-0000-0000-000000000002', 'RT-2', null, 1000, 100, 900, 'transfer', 'paid', gen_random_uuid(), 'x', '2030-01-10 05:00+00'),
  ('24242424-0000-0000-0000-000000000003', 'RT-3', null, 60, 0, 60, 'promptpay', 'paid', gen_random_uuid(), 'x', '2030-01-10 07:00+00'),
  ('24242424-0000-0000-0000-000000000004', 'RT-4', null, 500, 0, 500, 'cash', 'voided', gen_random_uuid(), 'x', '2030-01-10 08:00+00'),
  ('24242424-0000-0000-0000-000000000005', 'RT-5', null, 100, 0, 100, 'cash', 'paid', gen_random_uuid(), 'x', '2030-01-10 16:30+00'),
  ('24242424-0000-0000-0000-000000000006', 'RT-6', null, 70, 0, 70, 'cash', 'paid', gen_random_uuid(), 'x', '2030-01-10 17:30+00');

insert into public.sale_items (sale_id, item_type, package_type_id, product_id, name, qty, unit_price, line_total) values
  ('24242424-0000-0000-0000-000000000001', 'package', '22222222-0000-0000-0000-000000000001', null, 'เดือนรายงาน', 1, 1200, 1200),
  ('24242424-0000-0000-0000-000000000002', 'package', '22222222-0000-0000-0000-000000000002', null, 'ครั้งรายงาน', 1, 950, 950),
  ('24242424-0000-0000-0000-000000000002', 'product', null, '23232323-0000-0000-0000-000000000001', 'น้ำรายงาน', 5, 10, 50),
  ('24242424-0000-0000-0000-000000000003', 'product', null, '23232323-0000-0000-0000-000000000002', 'เวย์รายงาน', 1, 60, 60),
  ('24242424-0000-0000-0000-000000000004', 'product', null, '23232323-0000-0000-0000-000000000002', 'เวย์รายงาน', 9, 60, 500),
  ('24242424-0000-0000-0000-000000000005', 'package', '22222222-0000-0000-0000-000000000001', null, 'เดือนรายงาน', 1, 100, 100),
  ('24242424-0000-0000-0000-000000000006', 'package', '22222222-0000-0000-0000-000000000001', null, 'เดือนรายงาน', 1, 70, 70);

-- Check-ins on 2030-01-10: members 1, 1, 2 (07:10, 07:40, 18:00 Bangkok) and an override for member 3 (09:00).
insert into public.check_ins (member_id, checked_in_at, check_in_date, override, override_reason, created_by) values
  ('21212121-0000-0000-0000-000000000001', '2030-01-10 00:10+00', '2030-01-10', false, null, '20202020-0000-0000-0000-0000000000a2'),
  ('21212121-0000-0000-0000-000000000001', '2030-01-10 00:40+00', '2030-01-10', false, null, '20202020-0000-0000-0000-0000000000a2'),
  ('21212121-0000-0000-0000-000000000002', '2030-01-10 11:00+00', '2030-01-10', false, null, '20202020-0000-0000-0000-0000000000a2'),
  ('21212121-0000-0000-0000-000000000003', '2030-01-10 02:00+00', '2030-01-10', true, 'ลืมบัตร', '20202020-0000-0000-0000-0000000000a2');

-- A class on 2030-01-10 with 2 attended, 1 no-show, 1 cancelled booking; 2 PT hours done by โค้ชรายงาน.
insert into public.trainers (id, name) values ('25252525-0000-0000-0000-000000000001', 'โค้ชรายงาน');
insert into public.class_types (id, name) values ('26262626-0000-0000-0000-000000000001', 'คลาสรายงาน');
insert into public.class_sessions (id, class_type_id, trainer_id, starts_at, ends_at, capacity) values
  ('27272727-0000-0000-0000-000000000001', '26262626-0000-0000-0000-000000000001', '25252525-0000-0000-0000-000000000001',
   '2030-01-10 11:00+00', '2030-01-10 12:00+00', 10);
insert into public.class_bookings (class_session_id, member_id, status) values
  ('27272727-0000-0000-0000-000000000001', '21212121-0000-0000-0000-000000000001', 'attended'),
  ('27272727-0000-0000-0000-000000000001', '21212121-0000-0000-0000-000000000002', 'attended'),
  ('27272727-0000-0000-0000-000000000001', '21212121-0000-0000-0000-000000000003', 'no_show'),
  ('27272727-0000-0000-0000-000000000001', '21212121-0000-0000-0000-000000000004', 'cancelled');
insert into public.memberships (id, member_id, package_type_id, kind, start_date, end_date, pt_left) values
  ('28282828-0000-0000-0000-000000000001', '21212121-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000003', 'pt', '2030-01-01', '2030-03-31', 8);
insert into public.pt_appointments (membership_id, trainer_id, starts_at, status, completed_at) values
  ('28282828-0000-0000-0000-000000000001', '25252525-0000-0000-0000-000000000001', '2030-01-10 10:00+00', 'done', '2030-01-10 11:00+00'),
  ('28282828-0000-0000-0000-000000000001', '25252525-0000-0000-0000-000000000001', '2030-01-10 12:00+00', 'done', '2030-01-10 13:00+00');

-- Member report fixtures, relative to today: 11 expiring, 12 renewed, 13 two visits left, 14 expired, 15 expired then rebought.
insert into public.memberships (member_id, package_type_id, kind, start_date, end_date, visits_left) values
  ('21212121-0000-0000-0000-000000000011', '22222222-0000-0000-0000-000000000001', 'duration', :'today'::date - 20, :'today'::date + 3, null),
  ('21212121-0000-0000-0000-000000000012', '22222222-0000-0000-0000-000000000001', 'duration', :'today'::date - 20, :'today'::date + 3, null),
  ('21212121-0000-0000-0000-000000000012', '22222222-0000-0000-0000-000000000001', 'duration', :'today'::date + 4, :'today'::date + 33, null),
  ('21212121-0000-0000-0000-000000000013', '22222222-0000-0000-0000-000000000002', 'visits', :'today'::date - 5, :'today'::date + 40, 2),
  ('21212121-0000-0000-0000-000000000014', '22222222-0000-0000-0000-000000000001', 'duration', :'today'::date - 34, :'today'::date - 5, null),
  ('21212121-0000-0000-0000-000000000015', '22222222-0000-0000-0000-000000000001', 'duration', :'today'::date - 34, :'today'::date - 5, null),
  ('21212121-0000-0000-0000-000000000015', '22222222-0000-0000-0000-000000000001', 'duration', :'today'::date - 1, :'today'::date + 28, null);

-- As owner -----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select public.report_sales('2030-01-10', '2030-01-10') as s10 \gset
select ok((:'s10'::jsonb #>> '{totals,bills}')::int = 4 and (:'s10'::jsonb #>> '{totals,net}')::numeric = 2260
  and (:'s10'::jsonb #>> '{totals,discount}')::numeric = 100 and (:'s10'::jsonb #>> '{totals,subtotal}')::numeric = 2360,
  'sales_totals');

select ok((:'s10'::jsonb #>> '{totals,voided_bills}')::int = 1
  and (select (p ->> 'bills')::int = 2 and (p ->> 'net')::numeric = 1300
       from jsonb_array_elements(:'s10'::jsonb -> 'by_payment') p where p ->> 'method' = 'cash')
  and (select (public.report_products('2030-01-10', '2030-01-10') -> 'best_sellers' -> 0 ->> 'name') = 'น้ำรายงาน'),
  'voided_excluded_everywhere');

select ok((select (d ->> 'bills')::int = 1 and (d ->> 'net')::numeric = 70
           from jsonb_array_elements(public.report_sales('2030-01-10', '2030-01-11') -> 'by_day') d where d ->> 'day' = '2030-01-11')
  and (select (d ->> 'bills')::int = 4
       from jsonb_array_elements(public.report_sales('2030-01-10', '2030-01-11') -> 'by_day') d where d ->> 'day' = '2030-01-10'),
  'sales_split_by_bangkok_day');

select ok(jsonb_array_length(public.report_sales('2030-01-09', '2030-01-12') -> 'by_day') = 4
  and (select (d ->> 'bills')::int = 0 from jsonb_array_elements(public.report_sales('2030-01-09', '2030-01-12') -> 'by_day') d
       where d ->> 'day' = '2030-01-09'),
  'by_day_fills_empty_days');

select is((select array_agg(p ->> 'method' order by p ->> 'method') from jsonb_array_elements(:'s10'::jsonb -> 'by_payment') p),
  array['cash', 'promptpay', 'transfer'], 'by_payment_has_three_methods');

select ok((:'s10'::jsonb #>> '{by_type,package}')::numeric + (:'s10'::jsonb #>> '{by_type,product}')::numeric
          = (:'s10'::jsonb #>> '{totals,subtotal}')::numeric
  and (:'s10'::jsonb #>> '{totals,net}')::numeric
      = (:'s10'::jsonb #>> '{totals,subtotal}')::numeric - (:'s10'::jsonb #>> '{totals,discount}')::numeric,
  'discount_reported_separately');

select public.report_checkins('2030-01-10', '2030-01-10') as c10 \gset
select ok((:'c10'::jsonb ->> 'total')::int = 4 and (:'c10'::jsonb ->> 'unique_members')::int = 3
  and jsonb_array_length(:'c10'::jsonb -> 'by_hour') = 24
  and (:'c10'::jsonb -> 'by_hour' -> 7 ->> 'total')::int = 2,
  'checkins_by_day_and_hour');

select public.report_members() as m \gset
select ok(exists (select 1 from jsonb_array_elements(:'m'::jsonb -> 'expiring') e
                  where e ->> 'member_id' = '21212121-0000-0000-0000-000000000011')
  and (:'m'::jsonb ->> 'active_count')::int >= 3,
  'members_active_and_expiring');
select ok(not exists (select 1 from jsonb_array_elements(:'m'::jsonb -> 'expiring') e
                      where e ->> 'member_id' = '21212121-0000-0000-0000-000000000012'), 'renewed_not_expiring');
select ok(exists (select 1 from jsonb_array_elements(:'m'::jsonb -> 'expiring') e
                  where e ->> 'member_id' = '21212121-0000-0000-0000-000000000013'), 'visits_two_left_expiring');
select ok(exists (select 1 from jsonb_array_elements(:'m'::jsonb -> 'expired_recent') e
                  where e ->> 'member_id' = '21212121-0000-0000-0000-000000000014'), 'expired_recent_listed');
select ok(not exists (select 1 from jsonb_array_elements(:'m'::jsonb -> 'expired_recent') e
                      where e ->> 'member_id' = '21212121-0000-0000-0000-000000000015'), 'rebought_not_expired');

select public.report_products('2030-01-10', '2030-01-10') as p \gset
select ok((:'p'::jsonb -> 'best_sellers' -> 0 ->> 'qty')::int = 5
  and (:'p'::jsonb -> 'best_sellers' -> 1 ->> 'name') = 'เวย์รายงาน'
  and (:'p'::jsonb -> 'best_sellers' -> 1 ->> 'qty')::int = 1,
  'best_sellers_ranked');
select ok(exists (select 1 from jsonb_array_elements(:'p'::jsonb -> 'low_stock') l where l ->> 'name' = 'ใกล้หมดรายงาน'),
  'low_stock_listed');

select ok((select count(*) = 1 from jsonb_array_elements(public.report_overrides('2030-01-10', '2030-01-10')) o
           where o ->> 'reason' = 'ลืมบัตร' and o ->> 'staff_name' = 'Staff' and o ->> 'member_name' = 'รายงาน 3'),
  'overrides_listed');

select public.report_classes('2030-01-10', '2030-01-10') as k \gset
select ok((select (s ->> 'booked')::int = 3 and (s ->> 'attended')::int = 2 and (s ->> 'no_show')::int = 1
           from jsonb_array_elements(:'k'::jsonb -> 'sessions') s where s ->> 'class_name' = 'คลาสรายงาน'),
  'classes_counts');
select ok((select (t ->> 'done')::int = 2 from jsonb_array_elements(:'k'::jsonb -> 'pt_by_trainer') t
           where t ->> 'trainer_name' = 'โค้ชรายงาน'), 'pt_by_trainer');

select throws_ok($$select public.report_sales('2020-01-01', '2026-01-01')$$, 'P0001', 'ช่วงวันที่ต้องไม่เกิน 1 ปี', 'range_too_long_rejected');
select throws_ok($$select public.report_sales('2030-01-11', '2030-01-10')$$, 'P0001', 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม', 'range_reversed_rejected');

-- As staff -----------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select lives_ok(format('select public.report_sales(%L, %L)', :'today', :'today'), 'staff_today_sales_ok');
select throws_ok($$select public.report_sales('2030-01-10', '2030-01-10')$$,
  'P0001', 'เฉพาะเจ้าของเท่านั้นที่ดูรายงานนี้ได้', 'staff_other_day_rejected');
select throws_ok($$select public.report_members()$$,
  'P0001', 'เฉพาะเจ้าของเท่านั้นที่ดูรายงานนี้ได้', 'staff_members_report_rejected');

select * from finish();
rollback;
