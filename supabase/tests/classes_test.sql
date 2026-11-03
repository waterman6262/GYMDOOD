begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

select public.bangkok_today() as today \gset

-- Fixtures -----------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'owner5@test.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'staff5@test.local');
insert into public.staff (user_id, name, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000e2', 'Staff', 'staff');

insert into public.members (id, name)
select ('12121212-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'คลาส ' || n
from generate_series(1, 12) n;

insert into public.package_types (id, name, kind, price, duration_days, visits, pt_sessions) values
  ('13131313-0000-0000-0000-000000000001', 'เดือนคลาส', 'duration', 1200, 30, null, null),
  ('13131313-0000-0000-0000-000000000002', 'ครั้งคลาส', 'visits', 900, 60, 10, null),
  ('13131313-0000-0000-0000-000000000003', 'PTคลาส', 'pt', 6000, 90, null, 10);

-- memberships 14141414-...-NN belong to member 12121212-...-NN
insert into public.memberships (id, member_id, package_type_id, kind, start_date, end_date, visits_left, pt_left)
select ('14141414-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       ('12121212-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       case k when 'duration' then '13131313-0000-0000-0000-000000000001'::uuid
              when 'visits' then '13131313-0000-0000-0000-000000000002'::uuid
              else '13131313-0000-0000-0000-000000000003'::uuid end,
       k, :'today'::date - 1, :'today'::date + 60,
       case k when 'visits' then 10 end,
       case when n = 9 then 2 when k = 'pt' then 5 end
from (values (1, 'duration'), (2, 'duration'), (4, 'duration'), (5, 'visits'), (6, 'visits'),
             (7, 'duration'), (8, 'duration'), (9, 'pt'), (10, 'pt'), (11, 'pt'), (12, 'pt')) v(n, k);

insert into public.freezes (membership_id, start_date, end_date, reason) values
  ('14141414-0000-0000-0000-000000000004', :'today', :'today'::date + 3, 'พัก'),
  ('14141414-0000-0000-0000-000000000011', :'today'::date + 2, :'today'::date + 4, 'พัก');

insert into public.trainers (id, name) values ('15151515-0000-0000-0000-000000000001', 'โค้ชทดสอบ');
insert into public.class_types (id, name, default_capacity) values ('16161616-0000-0000-0000-000000000001', 'โยคะทดสอบ', 10);

insert into public.class_sessions (id, class_type_id, trainer_id, starts_at, ends_at, capacity, cancelled) values
  ('17171717-0000-0000-0000-000000000001', '16161616-0000-0000-0000-000000000001', '15151515-0000-0000-0000-000000000001', now(), now() + interval '1 hour', 10, false),
  ('17171717-0000-0000-0000-000000000002', '16161616-0000-0000-0000-000000000001', null, now(), now() + interval '1 hour', 1, false),
  ('17171717-0000-0000-0000-000000000003', '16161616-0000-0000-0000-000000000001', null, now(), now() + interval '1 hour', 10, true),
  ('17171717-0000-0000-0000-000000000004', '16161616-0000-0000-0000-000000000001', null, now() - interval '2 hours', now() - interval '1 hour', 10, false),
  ('17171717-0000-0000-0000-000000000005', '16161616-0000-0000-0000-000000000001', null, now() + interval '1 day', now() + interval '25 hours', 10, false);

-- member 7 was booked before a freeze covering today was added
insert into public.class_bookings (id, class_session_id, member_id)
values ('18181818-0000-0000-0000-000000000007', '17171717-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000007');
insert into public.freezes (membership_id, start_date, end_date, reason)
values ('14141414-0000-0000-0000-000000000007', :'today', :'today', 'ป่วย');

select is(public.session_date('2026-11-04 17:30+00'), '2026-11-05'::date, 'session_date_is_bangkok_date');

-- As staff -----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';

select isnt(public.book_class('17171717-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000001'), null, 'book_ok');
select throws_ok($$select public.book_class('17171717-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000001')$$,
  'P0001', 'สมาชิกจองรอบนี้แล้ว', 'book_twice_rejected');

select public.book_class('17171717-0000-0000-0000-000000000002', '12121212-0000-0000-0000-000000000001') as full_b1 \gset
select throws_ok($$select public.book_class('17171717-0000-0000-0000-000000000002', '12121212-0000-0000-0000-000000000002')$$,
  'P0001', 'คลาสเต็มแล้ว', 'book_full_rejected');

select public.cancel_booking(:'full_b1');
select public.book_class('17171717-0000-0000-0000-000000000002', '12121212-0000-0000-0000-000000000002') as full_b2 \gset
select isnt(:'full_b2'::uuid, null::uuid, 'cancelled_booking_frees_seat');

select public.cancel_booking(:'full_b2');
select public.book_class('17171717-0000-0000-0000-000000000002', '12121212-0000-0000-0000-000000000001');
select ok((select count(*) = 1 and bool_and(status = 'booked') from public.class_bookings
           where class_session_id = '17171717-0000-0000-0000-000000000002' and member_id = '12121212-0000-0000-0000-000000000001'),
  'rebook_after_cancel_reuses_row');

select throws_ok($$select public.book_class('17171717-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000003')$$,
  'P0001', 'สมาชิกไม่มีแพ็กเกจที่ใช้ได้ในวันคลาส', 'book_without_access_rejected');
select throws_ok($$select public.book_class('17171717-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000004')$$,
  'P0001', 'สมาชิกไม่มีแพ็กเกจที่ใช้ได้ในวันคลาส', 'book_frozen_rejected');
select throws_ok($$select public.book_class('17171717-0000-0000-0000-000000000003', '12121212-0000-0000-0000-000000000001')$$,
  'P0001', 'รอบคลาสนี้ถูกยกเลิกแล้ว', 'book_cancelled_session_rejected');
select throws_ok($$select public.book_class('17171717-0000-0000-0000-000000000004', '12121212-0000-0000-0000-000000000001')$$,
  'P0001', 'คลาสนี้จบไปแล้ว', 'book_ended_session_rejected');

-- Attendance ---------------------------------------------------------------
select public.book_class('17171717-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000005') as b5 \gset
select public.mark_attendance(:'b5', true) as a5 \gset
select ok(:'a5'::jsonb ->> 'status' = 'attended' and :'a5'::jsonb ->> 'check_in_id' is not null
  and (select visits_left = 9 from public.memberships where id = '14141414-0000-0000-0000-000000000005'),
  'attend_checks_in_and_deducts');

select public.check_in('12121212-0000-0000-0000-000000000006') as morning \gset
select public.book_class('17171717-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000006') as b6 \gset
select public.mark_attendance(:'b6', true) as a6 \gset
select ok((select visits_left = 9 from public.memberships where id = '14141414-0000-0000-0000-000000000006')
  and (select count(*) = 1 from public.check_ins where member_id = '12121212-0000-0000-0000-000000000006' and check_in_date = :'today')
  and :'a6'::jsonb ->> 'check_in_id' = :'morning'::jsonb ->> 'check_in_id',
  'attend_after_morning_checkin_no_double');

select public.mark_attendance(:'b5', true);
select is((select count(*) from public.check_ins where member_id = '12121212-0000-0000-0000-000000000005'), 1::bigint,
  'attend_twice_idempotent');

select throws_ok($$select public.mark_attendance('18181818-0000-0000-0000-000000000007', true)$$,
  'P0001', 'เช็กชื่อไม่ได้: พักสมาชิกอยู่', 'attend_while_frozen_rejected');

select public.book_class('17171717-0000-0000-0000-000000000005', '12121212-0000-0000-0000-000000000001') as b_tomorrow \gset
select throws_ok(format('select public.mark_attendance(%L, true)', :'b_tomorrow'),
  'P0001', 'เช็กชื่อได้เฉพาะวันที่มีคลาส', 'attend_other_day_rejected');

select public.book_class('17171717-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000008') as b8 \gset
select public.mark_attendance(:'b8', false);
select ok((select status = 'no_show' from public.class_bookings where id = :'b8')
  and not exists (select 1 from public.check_ins where member_id = '12121212-0000-0000-0000-000000000008'),
  'no_show_marks');

-- PT -----------------------------------------------------------------------
select isnt(public.create_pt_appointment('14141414-0000-0000-0000-000000000009', '15151515-0000-0000-0000-000000000001', now() + interval '1 day'),
  null, 'pt_schedule_ok');
select public.create_pt_appointment('14141414-0000-0000-0000-000000000009', '15151515-0000-0000-0000-000000000001', now() + interval '2 days');
select throws_ok($$select public.create_pt_appointment('14141414-0000-0000-0000-000000000009', '15151515-0000-0000-0000-000000000001', now() + interval '3 days')$$,
  'P0001', 'ชั่วโมง PT ที่เหลือไม่พอสำหรับนัดเพิ่ม', 'pt_over_hours_rejected');
select throws_ok($$select public.create_pt_appointment('14141414-0000-0000-0000-000000000010', '15151515-0000-0000-0000-000000000001', now() + interval '100 days')$$,
  'P0001', 'วันนัดอยู่นอกช่วงของแพ็กเกจ', 'pt_outside_range_rejected');
select throws_ok($$select public.create_pt_appointment('14141414-0000-0000-0000-000000000011', '15151515-0000-0000-0000-000000000001', now() + interval '3 days')$$,
  'P0001', 'แพ็กเกจถูกพักในวันนัด', 'pt_frozen_day_rejected');

select public.create_pt_appointment('14141414-0000-0000-0000-000000000010', '15151515-0000-0000-0000-000000000001', now()) as pt1 \gset
select public.complete_pt(:'pt1') as left1 \gset
select ok(:left1 = 4 and (select status = 'done' from public.pt_appointments where id = :'pt1'), 'pt_complete_deducts');
select throws_ok(format('select public.complete_pt(%L)', :'pt1'), 'P0001', 'นัดนี้ปิดไปแล้ว', 'pt_complete_twice_rejected');

select public.create_pt_appointment('14141414-0000-0000-0000-000000000012', '15151515-0000-0000-0000-000000000001', now()) as pt2 \gset
reset role;
insert into public.freezes (membership_id, start_date, end_date, reason) values ('14141414-0000-0000-0000-000000000012', :'today', :'today', 'ป่วย');
set local role authenticated;
select throws_ok(format('select public.complete_pt(%L)', :'pt2'), 'P0001', 'แพ็กเกจถูกพักอยู่', 'complete_pt_while_frozen_rejected');

select public.create_pt_appointment('14141414-0000-0000-0000-000000000010', '15151515-0000-0000-0000-000000000001', now() + interval '2 days') as pt3 \gset
select public.cancel_pt(:'pt3');
select is((select pt_left from public.memberships where id = '14141414-0000-0000-0000-000000000010'), 4, 'pt_cancel_no_deduct');

select throws_ok($$insert into public.class_sessions (class_type_id, starts_at, ends_at, capacity)
  values ('16161616-0000-0000-0000-000000000001', now(), now() + interval '1 hour', 5)$$,
  '42501', null, 'staff_cannot_create_session');
select throws_ok($$insert into public.class_bookings (class_session_id, member_id)
  values ('17171717-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000002')$$,
  '42501', null, 'staff_cannot_insert_bookings_directly');

select * from finish();
rollback;
