-- Sales, memberships and receipts. Clients only read these tables; every
-- write goes through create_sale / void_sale so a sale is all-or-nothing.

create function public.bangkok_today() returns date
language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Bangkok')::date $$;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  member_id uuid references public.members (id),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  discount numeric(10, 2) not null default 0 check (discount >= 0),
  total numeric(10, 2) not null check (total >= 0),
  payment_method text not null check (payment_method in ('cash', 'transfer', 'promptpay')),
  status text not null default 'paid' check (status in ('paid', 'voided')),
  void_reason text,
  voided_by uuid references public.staff (id),
  voided_at timestamptz,
  receipt_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  client_request_id uuid not null unique,
  request_hash text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.staff (id),
  check (discount <= subtotal)
);

create index sales_created_at_idx on public.sales (created_at);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id),
  item_type text not null check (item_type in ('package')),
  package_type_id uuid references public.package_types (id),
  name text not null,
  qty int not null default 1 check (qty > 0),
  unit_price numeric(10, 2) not null,
  line_total numeric(10, 2) not null
);

create index sale_items_sale_id_idx on public.sale_items (sale_id);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  package_type_id uuid not null references public.package_types (id),
  sale_item_id uuid references public.sale_items (id),
  kind text not null check (kind in ('day', 'duration', 'visits', 'pt')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  visits_left int,
  pt_left int,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now()
);

create index memberships_member_id_idx on public.memberships (member_id);

create table public.receipt_counters (
  year int primary key,
  last_no int not null
);

-- Spec §6.2: a new duration package starts the day after the member's
-- current duration package ends; every other kind starts today.
create function public.membership_dates(p_member_id uuid, p_kind text, p_duration_days int, p_today date)
returns table (start_date date, end_date date)
language sql stable set search_path = ''
as $$
  select s, s + greatest(p_duration_days, 1) - 1
  from (
    select case
      when p_kind = 'duration' then coalesce((
        select max(m.end_date) + 1 from public.memberships m
        where m.member_id = p_member_id and m.kind = 'duration'
          and m.status = 'active' and m.end_date >= p_today
      ), p_today)
      else p_today
    end as s
  ) t
$$;

create function public.sale_result(p_sale public.sales) returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object('sale_id', p_sale.id, 'receipt_no', p_sale.receipt_no, 'receipt_token', p_sale.receipt_token)
$$;

create function public.create_sale(
  p_client_request_id uuid,
  p_member_id uuid,
  p_items jsonb,
  p_discount numeric,
  p_payment_method text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_staff uuid := public.current_staff_id();
  v_today date := public.bangkok_today();
  v_sale public.sales;
  v_pkg public.package_types;
  v_item jsonb;
  v_member_ids uuid[];
  v_member uuid;
  v_subtotal numeric(10, 2) := 0;
  v_discount numeric(10, 2) := coalesce(p_discount, 0);
  v_no int;
  v_sale_item_id uuid;
  v_start date;
  v_end date;
  v_hash text := md5(jsonb_build_array(p_member_id, p_items, coalesce(p_discount, 0), p_payment_method)::text);
begin
  if v_staff is null then
    raise exception 'ไม่มีสิทธิ์ทำรายการ';
  end if;

  -- Concurrent calls with the same request id queue here, so the second one
  -- sees the first one's committed sale below instead of a duplicate-key error.
  perform pg_advisory_xact_lock(hashtextextended(p_client_request_id::text, 0));

  -- A retried request (double tap, network retry) gets the original sale back,
  -- but only if it is the same cart; otherwise the receipt wouldn't match.
  select * into v_sale from public.sales where client_request_id = p_client_request_id;
  if found then
    if v_sale.request_hash <> v_hash then
      raise exception 'รายการนี้ถูกบันทึกไปแล้วด้วยข้อมูลอื่น กรุณาตรวจที่รายการบิลก่อนขายใหม่';
    end if;
    return public.sale_result(v_sale);
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ตะกร้าว่าง';
  end if;
  if p_member_id is null then
    raise exception 'กรุณาเลือกสมาชิก';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'transfer', 'promptpay') then
    raise exception 'วิธีชำระเงินไม่ถูกต้อง';
  end if;
  if not exists (select 1 from public.members where id = p_member_id and active) then
    raise exception 'สมาชิกถูกปิดใช้งาน';
  end if;

  -- Validate every line and total the prices from the database.
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_pkg from public.package_types where id = (v_item ->> 'package_type_id')::uuid;
    if not found then
      raise exception 'ไม่พบแพ็กเกจ';
    end if;
    if not v_pkg.active then
      raise exception using message = format('แพ็กเกจ "%s" ปิดขายแล้ว', v_pkg.name);
    end if;

    v_member_ids := array(select jsonb_array_elements_text(coalesce(v_item -> 'member_ids', '[]'::jsonb))::uuid);
    if cardinality(v_member_ids) <> v_pkg.seats
       or (select count(distinct x) from unnest(v_member_ids) x) <> v_pkg.seats then
      raise exception using message = format('แพ็กเกจ "%s" ต้องเลือกสมาชิก %s คนไม่ซ้ำกัน', v_pkg.name, v_pkg.seats);
    end if;
    if exists (
      select 1 from unnest(v_member_ids) x
      where not exists (select 1 from public.members m where m.id = x and m.active)
    ) then
      raise exception 'สมาชิกถูกปิดใช้งาน';
    end if;

    v_subtotal := v_subtotal + v_pkg.price;
  end loop;

  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'ส่วนลดต้องอยู่ระหว่าง 0 ถึงยอดรวม';
  end if;

  -- The counter row stays locked until this transaction ends, so concurrent
  -- sales get consecutive, unique numbers.
  insert into public.receipt_counters (year, last_no)
  values (extract(year from v_today)::int, 1)
  on conflict (year) do update set last_no = public.receipt_counters.last_no + 1
  returning last_no into v_no;

  insert into public.sales (receipt_no, member_id, subtotal, discount, total, payment_method, client_request_id, request_hash, created_by)
  values (
    format('R%s-%s', extract(year from v_today)::int, lpad(v_no::text, 6, '0')),
    p_member_id, v_subtotal, v_discount, v_subtotal - v_discount, p_payment_method, p_client_request_id, v_hash, v_staff
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_pkg from public.package_types where id = (v_item ->> 'package_type_id')::uuid;

    insert into public.sale_items (sale_id, item_type, package_type_id, name, qty, unit_price, line_total)
    values (v_sale.id, 'package', v_pkg.id, v_pkg.name, 1, v_pkg.price, v_pkg.price)
    returning id into v_sale_item_id;

    for v_member in select jsonb_array_elements_text(v_item -> 'member_ids')::uuid loop
      select d.start_date, d.end_date into v_start, v_end
      from public.membership_dates(v_member, v_pkg.kind, v_pkg.duration_days, v_today) d;

      insert into public.memberships (member_id, package_type_id, sale_item_id, kind, start_date, end_date, visits_left, pt_left)
      values (v_member, v_pkg.id, v_sale_item_id, v_pkg.kind, v_start, v_end, v_pkg.visits, v_pkg.pt_sessions);
    end loop;
  end loop;

  return public.sale_result(v_sale);
end
$$;

create function public.void_sale(p_sale_id uuid, p_reason text) returns void
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
end
$$;

-- Public receipt by unguessable token. Returns only what a receipt shows:
-- never the member's phone, LINE or notes.
create function public.get_receipt(p_token text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'receipt_no', s.receipt_no,
    'created_at', s.created_at,
    'status', s.status,
    'subtotal', s.subtotal,
    'discount', s.discount,
    'total', s.total,
    'payment_method', s.payment_method,
    'member_name', m.name,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.id)
      from public.sale_items i where i.sale_id = s.id
    ), '[]'::jsonb),
    'gym', (
      select jsonb_build_object('gym_name', g.gym_name, 'address', g.address, 'phone', g.phone, 'receipt_footer', g.receipt_footer)
      from public.settings g where g.id = 1
    )
  )
  from public.sales s
  left join public.members m on m.id = s.member_id
  where s.receipt_token = p_token
$$;

-- Row Level Security: staff read, nobody writes directly.
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.memberships enable row level security;
alter table public.receipt_counters enable row level security;

create policy sales_select on public.sales for select to authenticated using (public.is_staff());
create policy sale_items_select on public.sale_items for select to authenticated using (public.is_staff());
create policy memberships_select on public.memberships for select to authenticated using (public.is_staff());

revoke execute on function public.create_sale(uuid, uuid, jsonb, numeric, text) from public, anon;
revoke execute on function public.void_sale(uuid, text) from public, anon;
grant execute on function public.create_sale(uuid, uuid, jsonb, numeric, text) to authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;
grant execute on function public.get_receipt(text) to anon, authenticated;
