begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Test users: owner, active staff, deactivated staff
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'staff@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'gone@test.local');

insert into public.staff (user_id, name, role, active) values
  ('00000000-0000-0000-0000-0000000000a1', 'Owner', 'owner', true),
  ('00000000-0000-0000-0000-0000000000a2', 'Staff', 'staff', true),
  ('00000000-0000-0000-0000-0000000000a3', 'Gone', 'staff', false);

insert into public.members (name, phone) values ('ทดสอบ หนึ่ง', '081-234-5678');
insert into public.package_types (name, kind, price, duration_days)
  values ('รายเดือนทดสอบ', 'duration', 1200, 30);

-- Data checks run as postgres
select is(
  (select length(member_code) from public.members where name = 'ทดสอบ หนึ่ง'),
  8, 'member_code_generated');

select is(
  (select phone_digits from public.members where name = 'ทดสอบ หนึ่ง'),
  '0812345678', 'phone_digits_strips_dashes');

select throws_ok(
  $$insert into public.package_types (name, kind, price, duration_days) values ('x', 'visits', 900, 60)$$,
  '23514', null, 'visits_package_requires_visits');

select throws_ok(
  $$insert into public.package_types (name, kind, price, duration_days) values ('x', 'duration', -1, 30)$$,
  '23514', null, 'negative_price_rejected');

-- As active staff
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select ok((select count(*) from public.members) > 0, 'staff_can_read_members');

select is_empty(
  $$update public.package_types set price = 1 returning id$$,
  'staff_cannot_update_package_price');

select is_empty(
  $$update public.staff set role = 'owner' where user_id = auth.uid() returning id$$,
  'staff_cannot_promote_self');

select throws_ok(
  $$update public.members set active = false$$,
  '42501', null, 'staff_cannot_deactivate_member');

-- As deactivated staff
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select is((select count(*) from public.members), 0::bigint, 'inactive_staff_sees_nothing');

-- As owner
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is_empty(
  $$delete from public.members returning id$$,
  'nobody_can_delete_member');

select * from finish();
rollback;
