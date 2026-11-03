-- Check-ins, membership freezes and member photo storage. As with sales,
-- clients only read these tables; writes go through the functions below.

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  membership_id uuid references public.memberships (id),
  checked_in_at timestamptz not null default now(),
  check_in_date date not null default public.bangkok_today(),
  override boolean not null default false,
  override_reason text,
  visit_deducted boolean not null default false,
  created_by uuid references public.staff (id),
  check ((not override) or btrim(coalesce(override_reason, '')) <> '')
);

create index check_ins_member_day_idx on public.check_ins (member_id, check_in_date);
create index check_ins_day_idx on public.check_ins (check_in_date);

create table public.freezes (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  reason text not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  created_by uuid references public.staff (id)
);

create index freezes_membership_idx on public.freezes (membership_id);

create function public.is_frozen(p_membership_id uuid, p_day date) returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.freezes f
    where f.membership_id = p_membership_id and f.status = 'active'
      and p_day between f.start_date and f.end_date
  )
$$;

-- Spec §6.1. Finds today's usable gym membership (soonest to expire first),
-- records the check-in and deducts at most one visit per member per day.
create function public.check_in(p_member_id uuid, p_override_reason text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_staff uuid := public.current_staff_id();
  v_today date := public.bangkok_today();
  v_member public.members;
  v_ms public.memberships;
  v_package_name text;
  v_already boolean;
  v_deducted boolean := false;
  v_check_in_id uuid;
  v_next date;
  v_status text;
  v_reason text;
  v_days_left int;
begin
  if v_staff is null then
    raise exception 'ไม่มีสิทธิ์ทำรายการ';
  end if;

  select * into v_member from public.members where id = p_member_id;
  if not found or not v_member.active then
    raise exception 'สมาชิกถูกปิดใช้งาน';
  end if;

  -- One check-in at a time per member, so two quick scans can't both deduct.
  perform pg_advisory_xact_lock(hashtextextended('check_in:' || p_member_id::text, 0));

  v_already := exists (select 1 from public.check_ins where member_id = p_member_id and check_in_date = v_today);

  select min(start_date) into v_next from public.memberships
  where member_id = p_member_id and status = 'active'
    and kind in ('day', 'duration', 'visits') and start_date > v_today;

  select m.* into v_ms from public.memberships m
  where m.member_id = p_member_id and m.status = 'active'
    and m.kind in ('day', 'duration', 'visits')
    and v_today between m.start_date and m.end_date
    and (m.kind <> 'visits' or m.visits_left > 0)
    and not public.is_frozen(m.id, v_today)
  order by m.end_date, m.created_at
  limit 1
  for update;

  if found then
    if v_ms.kind = 'visits' and not exists (
      select 1 from public.check_ins
      where member_id = p_member_id and check_in_date = v_today and visit_deducted
    ) then
      update public.memberships set visits_left = visits_left - 1 where id = v_ms.id returning * into v_ms;
      v_deducted := true;
    end if;

    insert into public.check_ins (member_id, membership_id, check_in_date, visit_deducted, created_by)
    values (p_member_id, v_ms.id, v_today, v_deducted, v_staff)
    returning id into v_check_in_id;

    v_days_left := v_ms.end_date - v_today + 1;
    -- Warn only when nothing is lined up to follow; a day pass is never "running out".
    v_status := case
      when v_next is null and v_ms.kind <> 'day'
           and (v_days_left <= 7 or (v_ms.kind = 'visits' and v_ms.visits_left <= 2))
        then 'warning'
      else 'ok'
    end;
    select name into v_package_name from public.package_types where id = v_ms.package_type_id;
  else
    v_status := 'denied';
    v_reason := case
      when exists (
        select 1 from public.memberships m
        where m.member_id = p_member_id and m.status = 'active' and m.kind in ('day', 'duration', 'visits')
          and v_today between m.start_date and m.end_date and public.is_frozen(m.id, v_today)
      ) then 'frozen'
      when exists (
        select 1 from public.memberships m
        where m.member_id = p_member_id and m.status = 'active' and m.kind = 'visits'
          and v_today between m.start_date and m.end_date and m.visits_left <= 0
      ) then 'used_up'
      when exists (
        select 1 from public.memberships m
        where m.member_id = p_member_id and m.status = 'active'
          and m.kind in ('day', 'duration', 'visits') and m.start_date <= v_today
      ) then 'expired'
      when v_next is not null then 'not_started'
      else 'none'
    end;

    if btrim(coalesce(p_override_reason, '')) <> '' then
      insert into public.check_ins (member_id, check_in_date, override, override_reason, created_by)
      values (p_member_id, v_today, true, btrim(p_override_reason), v_staff)
      returning id into v_check_in_id;
    end if;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'check_in_id', v_check_in_id,
    'reason', v_reason,
    'membership', case when v_ms.id is null then null else jsonb_build_object(
      'id', v_ms.id, 'package_name', v_package_name, 'kind', v_ms.kind,
      'end_date', v_ms.end_date, 'visits_left', v_ms.visits_left
    ) end,
    'days_left', v_days_left,
    'visit_deducted', v_deducted,
    'already_today', v_already,
    'next_start_date', v_next,
    'member', jsonb_build_object('id', v_member.id, 'name', v_member.name, 'member_code', v_member.member_code)
  );
end
$$;

-- Spec §6.4. Freezing pushes the membership's end date (and any duration
-- package queued after it) out by the number of frozen days.
create function public.freeze_membership(p_membership_id uuid, p_start date, p_end date, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := public.bangkok_today();
  v_ms public.memberships;
  v_days int;
begin
  if not public.is_staff() then
    raise exception 'ไม่มีสิทธิ์ทำรายการ';
  end if;

  select * into v_ms from public.memberships where id = p_membership_id for update;
  if not found or v_ms.status <> 'active' then
    raise exception 'ไม่พบแพ็กเกจ';
  end if;
  if v_ms.kind = 'day' then
    raise exception 'แพ็กเกจรายวันพักไม่ได้';
  end if;
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม';
  end if;
  if p_start < v_today then
    raise exception 'วันเริ่มพักต้องไม่ย้อนหลัง';
  end if;
  if p_start < v_ms.start_date then
    raise exception 'วันเริ่มพักต้องไม่ก่อนวันเริ่มแพ็กเกจ';
  end if;
  if p_start > v_ms.end_date then
    raise exception 'แพ็กเกจหมดอายุก่อนวันเริ่มพัก';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'กรุณาระบุเหตุผล';
  end if;
  if exists (
    select 1 from public.freezes f
    where f.membership_id = p_membership_id and f.status = 'active'
      and daterange(f.start_date, f.end_date, '[]') && daterange(p_start, p_end, '[]')
  ) then
    raise exception 'ช่วงที่พักซ้อนกับการพักเดิม';
  end if;

  v_days := p_end - p_start + 1;

  if v_ms.kind = 'duration' then
    -- Queued packages move as a whole, including their own freezes.
    update public.freezes
    set start_date = start_date + v_days, end_date = end_date + v_days
    where status = 'active' and membership_id in (
      select id from public.memberships
      where member_id = v_ms.member_id and kind = 'duration' and status = 'active'
        and id <> v_ms.id and start_date > v_ms.end_date
    );
    update public.memberships
    set start_date = start_date + v_days, end_date = end_date + v_days
    where member_id = v_ms.member_id and kind = 'duration' and status = 'active'
      and id <> v_ms.id and start_date > v_ms.end_date;
  end if;

  update public.memberships set end_date = end_date + v_days where id = p_membership_id;

  insert into public.freezes (membership_id, start_date, end_date, reason, created_by)
  values (p_membership_id, p_start, p_end, btrim(p_reason), public.current_staff_id());
end
$$;

-- Ends a freeze early and gives back the days not yet frozen.
create function public.unfreeze_membership(p_freeze_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := public.bangkok_today();
  v_freeze public.freezes;
  v_ms public.memberships;
  v_restore int;
begin
  if not public.is_staff() then
    raise exception 'ไม่มีสิทธิ์ทำรายการ';
  end if;

  select * into v_freeze from public.freezes where id = p_freeze_id for update;
  if not found then
    raise exception 'ไม่พบการพัก';
  end if;
  if v_freeze.status <> 'active' then
    raise exception 'การพักนี้ถูกยกเลิกไปแล้ว';
  end if;
  if v_freeze.end_date < v_today then
    raise exception 'การพักนี้สิ้นสุดไปแล้ว';
  end if;

  select * into v_ms from public.memberships where id = v_freeze.membership_id for update;
  if v_ms.status <> 'active' then
    raise exception 'แพ็กเกจนี้ถูกยกเลิกแล้ว';
  end if;

  if v_freeze.start_date >= v_today then
    -- Not started yet (or starts today): give back every day.
    v_restore := v_freeze.end_date - v_freeze.start_date + 1;
    update public.freezes set status = 'cancelled' where id = p_freeze_id;
  else
    -- Already running: keep the days used up to yesterday.
    v_restore := v_freeze.end_date - (v_today - 1);
    update public.freezes set end_date = v_today - 1 where id = p_freeze_id;
  end if;

  if v_ms.kind = 'duration' then
    update public.freezes
    set start_date = start_date - v_restore, end_date = end_date - v_restore
    where status = 'active' and membership_id in (
      select id from public.memberships
      where member_id = v_ms.member_id and kind = 'duration' and status = 'active'
        and id <> v_ms.id and start_date > v_ms.end_date
    );
    update public.memberships
    set start_date = start_date - v_restore, end_date = end_date - v_restore
    where member_id = v_ms.member_id and kind = 'duration' and status = 'active'
      and id <> v_ms.id and start_date > v_ms.end_date;
  end if;

  update public.memberships set end_date = end_date - v_restore where id = v_ms.id;
end
$$;

-- Row Level Security: staff read, nobody writes directly.
alter table public.check_ins enable row level security;
alter table public.freezes enable row level security;

create policy check_ins_select on public.check_ins for select to authenticated using (public.is_staff());
create policy freezes_select on public.freezes for select to authenticated using (public.is_staff());

revoke execute on function public.check_in(uuid, text) from public, anon;
revoke execute on function public.freeze_membership(uuid, date, date, text) from public, anon;
revoke execute on function public.unfreeze_membership(uuid) from public, anon;
grant execute on function public.check_in(uuid, text) to authenticated;
grant execute on function public.freeze_membership(uuid, date, date, text) to authenticated;
grant execute on function public.unfreeze_membership(uuid) to authenticated;

-- Member photos: private bucket, active staff only.
insert into storage.buckets (id, name, public) values ('member-photos', 'member-photos', false);

create policy member_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'member-photos' and public.is_staff());
create policy member_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and public.is_staff());
create policy member_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and public.is_staff())
  with check (bucket_id = 'member-photos' and public.is_staff());
