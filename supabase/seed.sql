-- Local development data only. Never run against production.
-- Test logins (local only):
--   owner@gym.test / owner-pass-1234  (เจ้าของ)
--   staff@gym.test / staff-pass-1234  (พนักงาน)

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'owner@gym.test',
   extensions.crypt('owner-pass-1234', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'staff@gym.test',
   extensions.crypt('staff-pass-1234', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('owner@gym.test', 'staff@gym.test');

insert into public.staff (user_id, name, role) values
  ('11111111-1111-1111-1111-111111111111', 'เจ้าของยิม', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'พนักงานหน้าเคาน์เตอร์', 'staff');

insert into public.package_types (name, kind, price, duration_days, visits, pt_sessions, seats, tag) values
  ('รายวัน', 'day', 100, 1, null, null, 1, null),
  ('รายเดือน', 'duration', 1200, 30, null, null, 1, null),
  ('รายปี', 'duration', 9900, 365, null, null, 1, null),
  ('10 ครั้ง', 'visits', 900, 60, 10, null, 1, null),
  ('PT 10 ชั่วโมง', 'pt', 6000, 90, null, 10, 1, null),
  ('รายเดือน คู่', 'duration', 2000, 30, null, null, 2, 'คู่');

insert into public.members (member_code, name, phone, note) values
  ('A1000001', 'สมหญิง ใจดี', '0811111111', null),
  ('A1000002', 'วิชัย แข็งแรง', '0822222222', null),
  ('A1000003', 'นภา ฟิตเสมอ', '0833333333', 'แพ้ถั่ว'),
  ('A1000004', 'ประยุทธ์ ครอบครัว', '0844444444', 'พ่อ'),
  ('A1000005', 'ปิยะ ครอบครัว', '0844444444', 'ลูก ใช้เบอร์พ่อ');

update public.settings set gym_name = 'GYMDOOD', receipt_footer = 'ขอบคุณที่ใช้บริการ' where id = 1;

insert into public.products (name, price, track_stock, stock_qty, low_stock_at) values
  ('น้ำดื่ม', 10, true, 48, 12),
  ('เวย์โปรตีน 1 ซอง', 60, true, 20, 5),
  ('เกลือแร่', 25, true, 3, 6),
  ('เช่าผ้าเช็ดตัว', 20, false, 0, 0),
  ('เช่าล็อกเกอร์ (วัน)', 30, false, 0, 0);

insert into public.trainers (name, phone) values ('โค้ชเอ', '0855555555'), ('โค้ชบี', '0866666666');
insert into public.class_types (name, default_capacity) values ('โยคะ', 15), ('มวยไทย', 10);
