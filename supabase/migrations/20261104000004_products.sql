-- Counter products and stock. Stock only changes through the functions below,
-- and every change leaves a stock_movements row (spec §6.7).

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  price numeric(10, 2) not null check (price >= 0),
  track_stock boolean not null default true,
  stock_qty int not null default 0 check (stock_qty >= 0),
  low_stock_at int not null default 5 check (low_stock_at >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  change int not null check (change <> 0),
  reason text not null check (reason in ('sale', 'receive', 'adjust', 'void')),
  sale_id uuid references public.sales (id),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.staff (id)
);

create index stock_movements_product_idx on public.stock_movements (product_id, created_at);

alter table public.sale_items drop constraint sale_items_item_type_check;
alter table public.sale_items add constraint sale_items_item_type_check check (item_type in ('package', 'product'));
alter table public.sale_items add column product_id uuid references public.products (id);
alter table public.sale_items add constraint sale_items_kind_ref check (
  (item_type = 'package' and package_type_id is not null and product_id is null)
  or (item_type = 'product' and product_id is not null and package_type_id is null)
);

create function public.receive_stock(p_product_id uuid, p_qty int, p_note text) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_product public.products;
begin
  if not public.is_staff() then
    raise exception 'ไม่มีสิทธิ์ทำรายการ';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'จำนวนรับเข้าต้องมากกว่า 0';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found or not v_product.track_stock then
    raise exception 'สินค้านี้ไม่ได้นับสต็อก';
  end if;

  update public.products set stock_qty = stock_qty + p_qty where id = p_product_id returning * into v_product;
  insert into public.stock_movements (product_id, change, reason, note, created_by)
  values (p_product_id, p_qty, 'receive', nullif(btrim(coalesce(p_note, '')), ''), public.current_staff_id());
  return v_product.stock_qty;
end
$$;

-- Owner sets the count found on the shelf; the difference is recorded.
create function public.adjust_stock(p_product_id uuid, p_counted int, p_note text) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_product public.products;
  v_diff int;
begin
  if not public.is_owner() then
    raise exception 'เฉพาะเจ้าของเท่านั้นที่ปรับยอดสต็อกได้';
  end if;
  if p_counted is null or p_counted < 0 then
    raise exception 'จำนวนต้องไม่ติดลบ';
  end if;
  if btrim(coalesce(p_note, '')) = '' then
    raise exception 'กรุณาระบุเหตุผล';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found or not v_product.track_stock then
    raise exception 'สินค้านี้ไม่ได้นับสต็อก';
  end if;

  v_diff := p_counted - v_product.stock_qty;
  if v_diff <> 0 then
    update public.products set stock_qty = p_counted where id = p_product_id;
    insert into public.stock_movements (product_id, change, reason, note, created_by)
    values (p_product_id, v_diff, 'adjust', btrim(p_note), public.current_staff_id());
  end if;
  return p_counted;
end
$$;

-- create_sale v2: lines are either a package {package_type_id, member_ids}
-- or a product {product_id, qty}. A member is only required for packages.
create or replace function public.create_sale(
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
  v_prod public.products;
  v_item jsonb;
  v_member_ids uuid[];
  v_member uuid;
  v_qty int;
  v_need record;
  v_has_package boolean;
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
  v_has_package := exists (select 1 from jsonb_array_elements(p_items) e where e ? 'package_type_id');
  if v_has_package and p_member_id is null then
    raise exception 'กรุณาเลือกสมาชิก';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'transfer', 'promptpay') then
    raise exception 'วิธีชำระเงินไม่ถูกต้อง';
  end if;
  if p_member_id is not null and not exists (select 1 from public.members where id = p_member_id and active) then
    raise exception 'สมาชิกถูกปิดใช้งาน';
  end if;

  -- Lock the products being sold, in id order so two carts can't deadlock.
  perform 1 from public.products
  where id in (
    select (e ->> 'product_id')::uuid from jsonb_array_elements(p_items) e where e ? 'product_id'
  )
  order by id
  for update;

  -- Validate every line and total the prices from the database. Package rows
  -- are share-locked so their price can't change before the lines are saved.
  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item ? 'package_type_id' then
      select * into v_pkg from public.package_types where id = (v_item ->> 'package_type_id')::uuid for share;
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
    elsif v_item ? 'product_id' then
      select * into v_prod from public.products where id = (v_item ->> 'product_id')::uuid;
      if not found then
        raise exception 'ไม่พบสินค้า';
      end if;
      if not v_prod.active then
        raise exception using message = format('สินค้า "%s" ปิดขายแล้ว', v_prod.name);
      end if;
      if jsonb_typeof(v_item -> 'qty') is distinct from 'number'
         or (v_item ->> 'qty')::numeric < 1
         or (v_item ->> 'qty')::numeric <> trunc((v_item ->> 'qty')::numeric) then
        raise exception 'จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 1';
      end if;

      v_subtotal := v_subtotal + v_prod.price * (v_item ->> 'qty')::int;
    else
      raise exception 'รายการในตะกร้าไม่ถูกต้อง';
    end if;
  end loop;

  -- Stock is checked against the cart's total per product, not line by line.
  for v_need in
    select p.name, p.stock_qty, sum((e ->> 'qty')::int) as qty
    from jsonb_array_elements(p_items) e
    join public.products p on p.id = (e ->> 'product_id')::uuid
    where e ? 'product_id' and p.track_stock
    group by p.id, p.name, p.stock_qty
  loop
    if v_need.qty > v_need.stock_qty then
      raise exception using message = format('สินค้า "%s" เหลือไม่พอ (เหลือ %s)', v_need.name, v_need.stock_qty);
    end if;
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
    if v_item ? 'package_type_id' then
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
    else
      select * into v_prod from public.products where id = (v_item ->> 'product_id')::uuid;
      v_qty := (v_item ->> 'qty')::int;

      insert into public.sale_items (sale_id, item_type, product_id, name, qty, unit_price, line_total)
      values (v_sale.id, 'product', v_prod.id, v_prod.name, v_qty, v_prod.price, v_prod.price * v_qty);

      if v_prod.track_stock then
        update public.products set stock_qty = stock_qty - v_qty where id = v_prod.id;
        insert into public.stock_movements (product_id, change, reason, sale_id, created_by)
        values (v_prod.id, -v_qty, 'sale', v_sale.id, v_staff);
      end if;
    end if;
  end loop;

  return public.sale_result(v_sale);
end
$$;

-- void_sale v2: also puts sold products back on the shelf.
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

  -- Add back on top of today's count (receipts or adjustments may have happened since).
  with returned as (
    select i.product_id, sum(i.qty)::int as qty
    from public.sale_items i
    join public.products p on p.id = i.product_id
    where i.sale_id = p_sale_id and i.item_type = 'product' and p.track_stock
    group by i.product_id
  ), moved as (
    insert into public.stock_movements (product_id, change, reason, sale_id, created_by)
    select product_id, qty, 'void', p_sale_id, public.current_staff_id() from returned
  )
  update public.products p set stock_qty = p.stock_qty + r.qty
  from returned r where p.id = r.product_id;
end
$$;

-- Row Level Security / privileges
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

create policy products_select on public.products for select to authenticated using (public.is_staff());
create policy products_insert on public.products for insert to authenticated with check (public.is_owner());
create policy products_update on public.products for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy stock_movements_select on public.stock_movements for select to authenticated using (public.is_staff());

-- stock_qty only changes through the functions above, even for the owner.
revoke update on public.products from authenticated;
grant update (name, price, track_stock, low_stock_at, active) on public.products to authenticated;
revoke insert on public.products from authenticated;
grant insert (name, price, track_stock, low_stock_at, active) on public.products to authenticated;

revoke execute on function public.receive_stock(uuid, int, text) from public, anon;
revoke execute on function public.adjust_stock(uuid, int, text) from public, anon;
grant execute on function public.receive_stock(uuid, int, text) to authenticated;
grant execute on function public.adjust_stock(uuid, int, text) to authenticated;
