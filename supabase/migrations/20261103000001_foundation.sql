-- Foundation: staff, members, package types, shop settings + RLS

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  role text not null check (role in ('owner', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Helper functions run as definer so RLS policies can look up the caller
-- without recursing into staff's own policies.
create function public.current_staff_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.staff where user_id = auth.uid() and active
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and active)
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff where user_id = auth.uid() and active and role = 'owner'
  )
$$;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  member_code text not null unique
    default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  name text not null check (btrim(name) <> ''),
  phone text,
  phone_digits text generated always as
    (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) stored,
  line_id text,
  photo_url text,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.staff (id) default public.current_staff_id()
);

-- Spec §3: only the owner may deactivate (or reactivate) a member.
create function public.members_guard_active() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.active is distinct from old.active
     and auth.uid() is not null and not public.is_owner() then
    raise exception 'เฉพาะเจ้าของเท่านั้นที่ปิดการใช้งานสมาชิกได้' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger members_guard_active before update on public.members
  for each row execute function public.members_guard_active();

create index members_name_idx on public.members (name);
create index members_phone_digits_idx on public.members (phone_digits);

create table public.package_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  kind text not null check (kind in ('day', 'duration', 'visits', 'pt')),
  price numeric(10, 2) not null check (price >= 0),
  duration_days int,
  visits int,
  pt_sessions int,
  seats int not null default 1 check (seats in (1, 2)),
  tag text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- coalesce: a CHECK that evaluates to NULL passes, so missing fields must become 0
  constraint package_kind_fields check (
    case kind
      when 'day' then coalesce(duration_days, 0) = 1
      when 'duration' then coalesce(duration_days, 0) > 0
      when 'visits' then coalesce(visits, 0) > 0 and coalesce(duration_days, 0) > 0
      when 'pt' then coalesce(pt_sessions, 0) > 0 and coalesce(duration_days, 0) > 0
    end
  )
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  gym_name text not null default '',
  address text not null default '',
  phone text not null default '',
  promptpay_id text not null default '',
  receipt_footer text not null default ''
);

insert into public.settings (id) values (1);

-- Row Level Security
alter table public.staff enable row level security;
alter table public.members enable row level security;
alter table public.package_types enable row level security;
alter table public.settings enable row level security;

create policy staff_select on public.staff for select to authenticated using (public.is_staff());
create policy staff_insert on public.staff for insert to authenticated with check (public.is_owner());
create policy staff_update on public.staff for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy staff_delete on public.staff for delete to authenticated using (public.is_owner());

create policy members_select on public.members for select to authenticated using (public.is_staff());
create policy members_insert on public.members for insert to authenticated with check (public.is_staff());
create policy members_update on public.members for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy package_types_select on public.package_types for select to authenticated using (public.is_staff());
create policy package_types_write on public.package_types for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy settings_select on public.settings for select to authenticated using (public.is_staff());
create policy settings_update on public.settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
