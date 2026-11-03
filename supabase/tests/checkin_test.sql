begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

select public.bangkok_today() as today \gset

-- Fixtures -----------------------------------------------------------------
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c2', 'staff3@test.local');
insert into public.staff (user_id, name, role) values ('00000000-0000-0000-0000-0000000000c2', 'Staff', 'staff');

insert into public.package_types (id, name, kind, price, duration_days, visits, pt_sessions) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'เดือนเช็กอิน', 'duration', 1200, 30, null, null),
  ('eeeeeeee-0000-0000-0000-000000000002', 'ครั้งเช็กอิน', 'visits', 900, 60, 10, null),
  ('eeeeeeee-0000-0000-0000-000000000003', 'PTเช็กอิน', 'pt', 6000, 90, null, 10),
  ('eeeeeeee-0000-0000-0000-000000000004', 'วันเช็กอิน', 'day', 100, 1, null, null);

insert into public.members (id, name, active)
select ('ffffffff-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'เช็กอิน ' || n, n <> 99
from generate_series(1, 19) n;
insert into public.members (id, name, active) values ('ffffffff-0000-0000-0000-000000000099', 'ปิดแล้ว', false);

-- membership ids: dddddddd-...-0000000000NN
insert into public.memberships (id, member_id, package_type_id, kind, start_date, end_date, visits_left, pt_left) values
  ('dddddddd-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date - 5, :'today'::date + 19, null, null),
  ('dddddddd-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000002', 'visits', :'today', :'today'::date + 59, 10, null),
  ('dddddddd-0000-0000-0000-000000000003', 'ffffffff-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date - 26, :'today'::date + 3, null, null),
  ('dddddddd-0000-0000-0000-000000000004', 'ffffffff-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000002', 'visits', :'today'::date - 10, :'today'::date + 49, 3, null),
  ('dddddddd-0000-0000-0000-000000000005', 'ffffffff-0000-0000-0000-000000000005', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date - 26, :'today'::date + 3, null, null),
  ('dddddddd-0000-0000-0000-000000000105', 'ffffffff-0000-0000-0000-000000000005', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date + 4, :'today'::date + 33, null, null),
  ('dddddddd-0000-0000-0000-000000000006', 'ffffffff-0000-0000-0000-000000000006', 'eeeeeeee-0000-0000-0000-000000000002', 'visits', :'today'::date - 29, :'today'::date + 30, 10, null),
  ('dddddddd-0000-0000-0000-000000000106', 'ffffffff-0000-0000-0000-000000000006', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date - 19, :'today'::date + 10, null, null),
  ('dddddddd-0000-0000-0000-000000000007', 'ffffffff-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date - 30, :'today'::date - 1, null, null),
  ('dddddddd-0000-0000-0000-000000000008', 'ffffffff-0000-0000-0000-000000000008', 'eeeeeeee-0000-0000-0000-000000000002', 'visits', :'today'::date - 10, :'today'::date + 49, 0, null),
  ('dddddddd-0000-0000-0000-000000000010', 'ffffffff-0000-0000-0000-000000000010', 'eeeeeeee-0000-0000-0000-000000000003', 'pt', :'today', :'today'::date + 89, null, 10),
  ('dddddddd-0000-0000-0000-000000000011', 'ffffffff-0000-0000-0000-000000000011', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date + 1, :'today'::date + 30, null, null),
  ('dddddddd-0000-0000-0000-000000000012', 'ffffffff-0000-0000-0000-000000000012', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date - 10, :'today'::date + 19, null, null),
  ('dddddddd-0000-0000-0000-000000000013', 'ffffffff-0000-0000-0000-000000000013', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date - 10, :'today'::date + 20, null, null),
  ('dddddddd-0000-0000-0000-000000000014', 'ffffffff-0000-0000-0000-000000000014', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date - 10, :'today'::date + 20, null, null),
  ('dddddddd-0000-0000-0000-000000000114', 'ffffffff-0000-0000-0000-000000000014', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date + 21, :'today'::date + 50, null, null),
  ('dddddddd-0000-0000-0000-000000000015', 'ffffffff-0000-0000-0000-000000000015', 'eeeeeeee-0000-0000-0000-000000000004', 'day', :'today', :'today', null, null),
  ('dddddddd-0000-0000-0000-000000000016', 'ffffffff-0000-0000-0000-000000000016', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today', :'today'::date + 29, null, null);

insert into public.freezes (membership_id, start_date, end_date, reason)
values ('dddddddd-0000-0000-0000-000000000012', :'today'::date - 1, :'today'::date + 2, 'ทดสอบ');

-- 17: queued package B already has its own freeze; 18: cancelled package with a freeze;
-- 19: freeze that started two days ago (end_date already includes the 7 days)
insert into public.memberships (id, member_id, package_type_id, kind, start_date, end_date, status) values
  ('dddddddd-0000-0000-0000-000000000017', 'ffffffff-0000-0000-0000-000000000017', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date - 10, :'today'::date + 20, 'active'),
  ('dddddddd-0000-0000-0000-000000000117', 'ffffffff-0000-0000-0000-000000000017', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date + 21, :'today'::date + 56, 'active'),
  ('dddddddd-0000-0000-0000-000000000018', 'ffffffff-0000-0000-0000-000000000018', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date - 10, :'today'::date + 27, 'cancelled'),
  ('dddddddd-0000-0000-0000-000000000019', 'ffffffff-0000-0000-0000-000000000019', 'eeeeeeee-0000-0000-0000-000000000001', 'duration', :'today'::date - 10, :'today'::date + 25, 'active');
insert into public.freezes (membership_id, start_date, end_date, reason) values
  ('dddddddd-0000-0000-0000-000000000117', :'today'::date + 25, :'today'::date + 30, 'คิวถัดไป'),
  ('dddddddd-0000-0000-0000-000000000018', :'today'::date, :'today'::date + 6, 'ถูกยกเลิก'),
  ('dddddddd-0000-0000-0000-000000000019', :'today'::date - 2, :'today'::date + 4, 'กำลังพัก');

select throws_ok(
  $$insert into public.check_ins (member_id, override, override_reason) values ('ffffffff-0000-0000-0000-000000000009', true, '  ')$$,
  '23514', null, 'override_without_reason_rejected_by_table');

-- As staff -----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';

select public.check_in('ffffffff-0000-0000-0000-000000000001') as r1 \gset
select ok(:'r1'::jsonb ->> 'status' = 'ok' and :'r1'::jsonb ->> 'check_in_id' is not null
  and (:'r1'::jsonb ->> 'visit_deducted')::bool = false, 'duration_member_ok');

select public.check_in('ffffffff-0000-0000-0000-000000000002') as r2 \gset
select ok((select visits_left = 9 from public.memberships where id = 'dddddddd-0000-0000-0000-000000000002')
  and (:'r2'::jsonb ->> 'visit_deducted')::bool, 'visits_deducts_one');

select public.check_in('ffffffff-0000-0000-0000-000000000002') as r2b \gset
select ok((select visits_left = 9 from public.memberships where id = 'dddddddd-0000-0000-0000-000000000002')
  and (:'r2b'::jsonb ->> 'already_today')::bool
  and (select count(*) = 2 from public.check_ins where member_id = 'ffffffff-0000-0000-0000-000000000002'),
  'visit_deducted_once_per_day');

select public.check_in('ffffffff-0000-0000-0000-000000000003') as r3 \gset
select ok(:'r3'::jsonb ->> 'status' = 'warning' and (:'r3'::jsonb ->> 'days_left')::int = 4, 'warning_when_few_days_left');

select is(public.check_in('ffffffff-0000-0000-0000-000000000004') ->> 'status', 'warning', 'warning_when_two_visits_left');

select is(public.check_in('ffffffff-0000-0000-0000-000000000005') ->> 'status', 'ok', 'no_warning_when_renewal_waiting');

select public.check_in('ffffffff-0000-0000-0000-000000000006') as r6 \gset
select ok(:'r6'::jsonb -> 'membership' ->> 'kind' = 'duration'
  and (select visits_left = 10 from public.memberships where id = 'dddddddd-0000-0000-0000-000000000006'),
  'picks_soonest_expiring');

select public.check_in('ffffffff-0000-0000-0000-000000000007') as r7 \gset
select ok(:'r7'::jsonb ->> 'status' = 'denied' and :'r7'::jsonb ->> 'reason' = 'expired'
  and :'r7'::jsonb ->> 'check_in_id' is null
  and not exists (select 1 from public.check_ins where member_id = 'ffffffff-0000-0000-0000-000000000007'),
  'expired_is_denied');

select is(public.check_in('ffffffff-0000-0000-0000-000000000008') ->> 'reason', 'used_up', 'used_up_is_denied');
select is(public.check_in('ffffffff-0000-0000-0000-000000000009') ->> 'reason', 'none', 'never_bought_is_denied');
select is(public.check_in('ffffffff-0000-0000-0000-000000000010') ->> 'reason', 'none', 'pt_only_is_denied');

select public.check_in('ffffffff-0000-0000-0000-000000000011') as r11 \gset
select ok(:'r11'::jsonb ->> 'status' = 'denied' and :'r11'::jsonb ->> 'reason' = 'not_started'
  and (:'r11'::jsonb ->> 'next_start_date')::date = :'today'::date + 1,
  'upcoming_only_is_denied_with_next_start');

select is(public.check_in('ffffffff-0000-0000-0000-000000000012') ->> 'reason', 'frozen', 'frozen_is_denied');

select public.check_in('ffffffff-0000-0000-0000-000000000009', 'โอนแล้ว รอตรวจ') as r9 \gset
select ok(:'r9'::jsonb ->> 'check_in_id' is not null
  and (select override and membership_id is null from public.check_ins where id = (:'r9'::jsonb ->> 'check_in_id')::uuid),
  'override_records_reason');

select throws_ok($$select public.check_in('ffffffff-0000-0000-0000-000000000099')$$,
  'P0001', 'สมาชิกถูกปิดใช้งาน', 'inactive_member_rejected');

-- Freeze -------------------------------------------------------------------
select public.freeze_membership('dddddddd-0000-0000-0000-000000000013', :'today', :'today'::date + 6, 'บาดเจ็บ');
select is((select end_date from public.memberships where id = 'dddddddd-0000-0000-0000-000000000013'),
  :'today'::date + 27, 'freeze_extends_end_date');

select public.freeze_membership('dddddddd-0000-0000-0000-000000000014', :'today', :'today'::date + 6, 'ไปต่างประเทศ');
select ok((select start_date = :'today'::date + 28 and end_date = :'today'::date + 57
  from public.memberships where id = 'dddddddd-0000-0000-0000-000000000114'), 'freeze_shifts_stacked_duration');

select throws_ok(format('select public.freeze_membership(%L, %L, %L, %L)', 'dddddddd-0000-0000-0000-000000000013', :'today'::date + 3, :'today'::date + 4, 'x'),
  'P0001', 'ช่วงที่พักซ้อนกับการพักเดิม', 'freeze_overlap_rejected');
select throws_ok(format('select public.freeze_membership(%L, %L, %L, %L)', 'dddddddd-0000-0000-0000-000000000001', :'today'::date + 30, :'today'::date + 31, 'x'),
  'P0001', 'แพ็กเกจหมดอายุก่อนวันเริ่มพัก', 'freeze_after_expiry_rejected');
select throws_ok(format('select public.freeze_membership(%L, %L, %L, %L)', 'dddddddd-0000-0000-0000-000000000001', :'today'::date + 5, :'today'::date + 4, 'x'),
  'P0001', 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม', 'freeze_end_before_start_rejected');
select throws_ok(format('select public.freeze_membership(%L, %L, %L, %L)', 'dddddddd-0000-0000-0000-000000000001', :'today'::date - 1, :'today'::date + 4, 'x'),
  'P0001', 'วันเริ่มพักต้องไม่ย้อนหลัง', 'freeze_in_past_rejected');
select throws_ok(format('select public.freeze_membership(%L, %L, %L, %L)', 'dddddddd-0000-0000-0000-000000000015', :'today', :'today', 'x'),
  'P0001', 'แพ็กเกจรายวันพักไม่ได้', 'freeze_day_pass_rejected');

select public.freeze_membership('dddddddd-0000-0000-0000-000000000016', :'today'::date + 5, :'today'::date + 9, 'ลา');
select public.unfreeze_membership((select id from public.freezes where membership_id = 'dddddddd-0000-0000-0000-000000000016'));
select ok((select end_date = :'today'::date + 29 from public.memberships where id = 'dddddddd-0000-0000-0000-000000000016')
  and (select status = 'cancelled' from public.freezes where membership_id = 'dddddddd-0000-0000-0000-000000000016'),
  'unfreeze_future_restores_all');

select public.unfreeze_membership((select id from public.freezes where membership_id = 'dddddddd-0000-0000-0000-000000000013'));
select ok((select end_date = :'today'::date + 20 from public.memberships where id = 'dddddddd-0000-0000-0000-000000000013')
  and (select status = 'cancelled' from public.freezes where membership_id = 'dddddddd-0000-0000-0000-000000000013'),
  'unfreeze_started_restores_rest');

select public.unfreeze_membership((select id from public.freezes where membership_id = 'dddddddd-0000-0000-0000-000000000014'));
select ok((select start_date = :'today'::date + 21 and end_date = :'today'::date + 50
  from public.memberships where id = 'dddddddd-0000-0000-0000-000000000114'), 'unfreeze_shifts_stacked_back');

select public.freeze_membership('dddddddd-0000-0000-0000-000000000017', :'today', :'today'::date + 6, 'ลา');
select ok((select start_date = :'today'::date + 32 and end_date = :'today'::date + 37
  from public.freezes where membership_id = 'dddddddd-0000-0000-0000-000000000117'), 'queued_freeze_moves_with_shift');

select throws_ok(format('select public.freeze_membership(%L, %L, %L, %L)', 'dddddddd-0000-0000-0000-000000000011', :'today', :'today', 'x'),
  'P0001', 'วันเริ่มพักต้องไม่ก่อนวันเริ่มแพ็กเกจ', 'freeze_before_package_start_rejected');

select throws_ok(format('select public.unfreeze_membership(%L)', (select id from public.freezes where membership_id = 'dddddddd-0000-0000-0000-000000000018')),
  'P0001', 'แพ็กเกจนี้ถูกยกเลิกแล้ว', 'unfreeze_cancelled_membership_rejected');

select public.unfreeze_membership((select id from public.freezes where membership_id = 'dddddddd-0000-0000-0000-000000000019'));
select ok((select end_date = :'today'::date + 20 from public.memberships where id = 'dddddddd-0000-0000-0000-000000000019')
  and (select status = 'active' and end_date = :'today'::date - 1 from public.freezes where membership_id = 'dddddddd-0000-0000-0000-000000000019'),
  'unfreeze_running_restores_remaining');

select throws_ok(
  $$insert into public.check_ins (member_id) values ('ffffffff-0000-0000-0000-000000000001')$$,
  '42501', null, 'staff_cannot_insert_check_ins_directly');

reset request.jwt.claims;
set local role anon;
select throws_ok($$select public.check_in('ffffffff-0000-0000-0000-000000000001')$$,
  '42501', null, 'anon_cannot_check_in');

select * from finish();
rollback;
