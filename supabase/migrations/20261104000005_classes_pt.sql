-- Classes and PT. The owner manages trainers, class types and the schedule
-- directly (RLS); bookings and PT appointments change only through functions.

create table public.trainers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.class_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  default_capacity int not null default 15 check (default_capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_type_id uuid not null references public.class_types (id),
  trainer_id uuid references public.trainers (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int not null check (capacity > 0),
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.staff (id) default public.current_staff_id(),
  check (ends_at > starts_at)
);

create index class_sessions_starts_idx on public.class_sessions (starts_at);

create table public.class_bookings (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_sessions (id),
  member_id uuid not null references public.members (id),
  status text not null default 'booked' check (status in ('booked', 'attended', 'no_show', 'cancelled')),
  check_in_id uuid references public.check_ins (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.staff (id),
  unique (class_session_id, member_id)
);

create table public.pt_appointments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id),
  trainer_id uuid not null references public.trainers (id),
  starts_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.staff (id)
);

create index pt_appointments_starts_idx on public.pt_appointments (starts_at);

create function public.session_date(p_starts_at timestamptz) returns date
language sql immutable set search_path = ''
as $$ select (p_starts_at at time zone 'Asia/Bangkok')::date $$;

-- Same rule as check-in (spec §6.1 step 2), for any given day.
create function public.has_gym_access(p_member_id uuid, p_day date) returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.member_id = p_member_id and m.status = 'active'
      and m.kind in ('day', 'duration', 'visits')
      and p_day between m.start_date and m.end_date
      and (m.kind <> 'visits' or m.visits_left > 0)
      and not public.is_frozen(m.id, p_day)
  )
$$;

-- Spec §6.5. The session row is locked so concurrent bookings can't overfill it.
create function public.book_class(p_session_id uuid, p_member_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_session public.class_sessions;
  v_booking public.class_bookings;
  v_taken int;
begin
  if not public.is_staff() then
    raise exception 'ไม่มีสิทธิ์ทำรายการ';
  end if;

  select * into v_session from public.class_sessions where id = p_session_id for update;
  if not found or v_session.cancelled then
    raise exception 'รอบคลาสนี้ถูกยกเลิกแล้ว';
  end if;
  if v_session.ends_at <= now() then
    raise exception 'คลาสนี้จบไปแล้ว';
  end if;
  if not exists (select 1 from public.members where id = p_member_id and active) then
    raise exception 'สมาชิกถูกปิดใช้งาน';
  end if;
  if not public.has_gym_access(p_member_id, public.session_date(v_session.starts_at)) then
    raise exception 'สมาชิกไม่มีแพ็กเกจที่ใช้ได้ในวันคลาส';
  end if;

  select * into v_booking from public.class_bookings
  where class_session_id = p_session_id and member_id = p_member_id;
  if found and v_booking.status <> 'cancelled' then
    raise exception 'สมาชิกจองรอบนี้แล้ว';
  end if;

  select count(*) into v_taken from public.class_bookings
  where class_session_id = p_session_id and status <> 'cancelled';
  if v_taken >= v_session.capacity then
    raise exception 'คลาสเต็มแล้ว';
  end if;

  if v_booking.id is not null then
    update public.class_bookings
    set status = 'booked', check_in_id = null, updated_at = now(), created_by = public.current_staff_id()
    where id = v_booking.id;
    return v_booking.id;
  end if;

  insert into public.class_bookings (class_session_id, member_id, created_by)
  values (p_session_id, p_member_id, public.current_staff_id())
  returning id into v_booking.id;
  return v_booking.id;
end
$$;

create function public.cancel_booking(p_booking_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'ไม่มีสิทธิ์ทำรายการ';
  end if;
  update public.class_bookings set status = 'cancelled', updated_at = now()
  where id = p_booking_id and status = 'booked';
  if not found then
    raise exception 'ยกเลิกได้เฉพาะการจองที่ยังไม่เช็กชื่อ';
  end if;
end
$$;

-- "มาแล้ว" checks the member in (spec §6.5) using the check-in rules, unless
-- they already checked in today, so a visit is never deducted twice.
create function public.mark_attendance(p_booking_id uuid, p_attended boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.class_bookings;
  v_starts_at timestamptz;
  v_cancelled boolean;
  v_check_in uuid;
  v_result jsonb;
begin
  if not public.is_staff() then
    raise exception 'ไม่มีสิทธิ์ทำรายการ';
  end if;

  select b.* into v_booking from public.class_bookings b where b.id = p_booking_id for update;
  if not found then
    raise exception 'ไม่พบการจอง';
  end if;
  if v_booking.status = 'cancelled' then
    raise exception 'การจองนี้ถูกยกเลิกแล้ว';
  end if;
  select starts_at, cancelled into v_starts_at, v_cancelled from public.class_sessions where id = v_booking.class_session_id;
  if v_cancelled then
    raise exception 'รอบคลาสนี้ถูกยกเลิกแล้ว';
  end if;
  if public.session_date(v_starts_at) <> public.bangkok_today() then
    raise exception 'เช็กชื่อได้เฉพาะวันที่มีคลาส';
  end if;

  if not p_attended then
    update public.class_bookings set status = 'no_show', updated_at = now() where id = p_booking_id;
    return jsonb_build_object('status', 'no_show', 'check_in_id', v_booking.check_in_id);
  end if;

  if v_booking.status = 'attended' then
    return jsonb_build_object('status', 'attended', 'check_in_id', v_booking.check_in_id);
  end if;

  select id into v_check_in from public.check_ins
  where member_id = v_booking.member_id and check_in_date = public.bangkok_today()
  order by checked_in_at
  limit 1;

  if v_check_in is null then
    v_result := public.check_in(v_booking.member_id);
    if v_result ->> 'status' = 'denied' then
      raise exception using message = 'เช็กชื่อไม่ได้: ' || case v_result ->> 'reason'
        when 'frozen' then 'พักสมาชิกอยู่'
        when 'used_up' then 'ใช้ครบจำนวนครั้งแล้ว'
        when 'expired' then 'แพ็กเกจหมดอายุ'
        when 'not_started' then 'แพ็กเกจยังไม่เริ่ม'
        else 'ยังไม่มีแพ็กเกจ'
      end;
    end if;
    v_check_in := (v_result ->> 'check_in_id')::uuid;
  end if;

  update public.class_bookings set status = 'attended', check_in_id = v_check_in, updated_at = now()
  where id = p_booking_id;
  return jsonb_build_object('status', 'attended', 'check_in_id', v_check_in);
end
$$;

-- Spec §6.6.
create function public.create_pt_appointment(p_membership_id uuid, p_trainer_id uuid, p_starts_at timestamptz) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_ms public.memberships;
  v_day date := public.session_date(p_starts_at);
  v_open int;
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'ไม่มีสิทธิ์ทำรายการ';
  end if;

  -- Locked so two appointments made at once can't both use the last hour.
  select * into v_ms from public.memberships where id = p_membership_id for update;
  if not found or v_ms.kind <> 'pt' or v_ms.status <> 'active' then
    raise exception 'ไม่พบแพ็กเกจ PT';
  end if;
  if p_starts_at is null or v_day not between v_ms.start_date and v_ms.end_date then
    raise exception 'วันนัดอยู่นอกช่วงของแพ็กเกจ';
  end if;
  if public.is_frozen(p_membership_id, v_day) then
    raise exception 'แพ็กเกจถูกพักในวันนัด';
  end if;
  if not exists (select 1 from public.trainers where id = p_trainer_id and active) then
    raise exception 'ไม่พบเทรนเนอร์';
  end if;

  select count(*) into v_open from public.pt_appointments
  where membership_id = p_membership_id and status = 'scheduled';
  if v_open + 1 > coalesce(v_ms.pt_left, 0) then
    raise exception 'ชั่วโมง PT ที่เหลือไม่พอสำหรับนัดเพิ่ม';
  end if;

  insert into public.pt_appointments (membership_id, trainer_id, starts_at, created_by)
  values (p_membership_id, p_trainer_id, p_starts_at, public.current_staff_id())
  returning id into v_id;
  return v_id;
end
$$;

create function public.complete_pt(p_appointment_id uuid) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_appt public.pt_appointments;
  v_ms public.memberships;
begin
  if not public.is_staff() then
    raise exception 'ไม่มีสิทธิ์ทำรายการ';
  end if;

  select * into v_appt from public.pt_appointments where id = p_appointment_id for update;
  if not found or v_appt.status <> 'scheduled' then
    raise exception 'นัดนี้ปิดไปแล้ว';
  end if;
  select * into v_ms from public.memberships where id = v_appt.membership_id for update;
  if v_ms.status <> 'active' then
    raise exception 'แพ็กเกจ PT ถูกยกเลิกแล้ว';
  end if;
  if coalesce(v_ms.pt_left, 0) <= 0 then
    raise exception 'แพ็กเกจ PT ไม่มีชั่วโมงเหลือ';
  end if;
  if public.is_frozen(v_ms.id, public.bangkok_today()) then
    raise exception 'แพ็กเกจถูกพักอยู่';
  end if;

  update public.pt_appointments set status = 'done', completed_at = now() where id = p_appointment_id;
  update public.memberships set pt_left = pt_left - 1 where id = v_ms.id returning * into v_ms;
  return v_ms.pt_left;
end
$$;

create function public.cancel_pt(p_appointment_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'ไม่มีสิทธิ์ทำรายการ';
  end if;
  update public.pt_appointments set status = 'cancelled' where id = p_appointment_id and status = 'scheduled';
  if not found then
    raise exception 'นัดนี้ปิดไปแล้ว';
  end if;
end
$$;

-- void_sale v3: also cancels open PT appointments of the packages it cancels.
create or replace function public.void_sale(p_sale_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_status text;
begin
  if not public.is_owner() then
    raise exception 'เฉพาะเจ้าของเท่านั้นที่ยกเลิกบิลได้';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'กรุณาระบุเหตุผล';
  end if;

  select status into v_status from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'ไม่พบบิล';
  end if;
  if v_status = 'voided' then
    raise exception 'บิลนี้ถูกยกเลิกไปแล้ว';
  end if;

  update public.sales
  set status = 'voided', void_reason = btrim(p_reason), voided_by = public.current_staff_id(), voided_at = now()
  where id = p_sale_id;

  update public.memberships set status = 'cancelled'
  where sale_item_id in (select id from public.sale_items where sale_id = p_sale_id);

  update public.pt_appointments set status = 'cancelled'
  where status = 'scheduled' and membership_id in (
    select m.id from public.memberships m
    join public.sale_items i on i.id = m.sale_item_id
    where i.sale_id = p_sale_id
  );

  -- Put back exactly what this sale took off the shelf (its own movements, so a
  -- later change to track_stock can't add or lose units), on top of today's
  -- count since receipts or adjustments may have happened in between.
  with returned as (
    select product_id, (-sum(change))::int as qty
    from public.stock_movements
    where sale_id = p_sale_id and reason = 'sale'
    group by product_id
  ), moved as (
    insert into public.stock_movements (product_id, change, reason, sale_id, created_by)
    select product_id, qty, 'void', p_sale_id, public.current_staff_id() from returned
  )
  update public.products p set stock_qty = p.stock_qty + r.qty
  from returned r where p.id = r.product_id;
end
$$;

-- Row Level Security
alter table public.trainers enable row level security;
alter table public.class_types enable row level security;
alter table public.class_sessions enable row level security;
alter table public.class_bookings enable row level security;
alter table public.pt_appointments enable row level security;

create policy trainers_select on public.trainers for select to authenticated using (public.is_staff());
create policy trainers_insert on public.trainers for insert to authenticated with check (public.is_owner());
create policy trainers_update on public.trainers for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy class_types_select on public.class_types for select to authenticated using (public.is_staff());
create policy class_types_insert on public.class_types for insert to authenticated with check (public.is_owner());
create policy class_types_update on public.class_types for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy class_sessions_select on public.class_sessions for select to authenticated using (public.is_staff());
create policy class_sessions_insert on public.class_sessions for insert to authenticated with check (public.is_owner());
create policy class_sessions_update on public.class_sessions for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy class_bookings_select on public.class_bookings for select to authenticated using (public.is_staff());
create policy pt_appointments_select on public.pt_appointments for select to authenticated using (public.is_staff());

revoke execute on function public.book_class(uuid, uuid) from public, anon;
revoke execute on function public.cancel_booking(uuid) from public, anon;
revoke execute on function public.mark_attendance(uuid, boolean) from public, anon;
revoke execute on function public.create_pt_appointment(uuid, uuid, timestamptz) from public, anon;
revoke execute on function public.complete_pt(uuid) from public, anon;
revoke execute on function public.cancel_pt(uuid) from public, anon;
grant execute on function public.book_class(uuid, uuid) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.mark_attendance(uuid, boolean) to authenticated;
grant execute on function public.create_pt_appointment(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.complete_pt(uuid) to authenticated;
grant execute on function public.cancel_pt(uuid) to authenticated;
