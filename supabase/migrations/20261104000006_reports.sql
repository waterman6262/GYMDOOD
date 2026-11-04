-- Reports (spec §7). Every figure is computed here, by Bangkok date. The owner
-- may read any range; other staff only today's sales summary.

create function public.require_report_owner() returns void
language plpgsql stable set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'เฉพาะเจ้าของเท่านั้นที่ดูรายงานนี้ได้';
  end if;
end
$$;

create function public.check_report_range(p_from date, p_to date) returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if p_from is null or p_to is null then
    raise exception 'กรุณาระบุช่วงวันที่';
  end if;
  if p_to < p_from then
    raise exception 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม';
  end if;
  if p_to - p_from + 1 > 366 then
    raise exception 'ช่วงวันที่ต้องไม่เกิน 1 ปี';
  end if;
end
$$;

create function public.report_sales(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := public.bangkok_today();
begin
  -- Staff may see today's summary only (spec §7).
  if not public.is_owner() and not (public.is_staff() and p_from = v_today and p_to = v_today) then
    raise exception 'เฉพาะเจ้าของเท่านั้นที่ดูรายงานนี้ได้';
  end if;
  perform public.check_report_range(p_from, p_to);

  return (
    with in_range as (
      select * from public.sales s where public.session_date(s.created_at) between p_from and p_to
    ), paid as (
      select * from in_range where status = 'paid'
    )
    select jsonb_build_object(
      'totals', (
        select jsonb_build_object(
          'bills', count(*) filter (where status = 'paid'),
          'subtotal', coalesce(sum(subtotal) filter (where status = 'paid'), 0),
          'discount', coalesce(sum(discount) filter (where status = 'paid'), 0),
          'net', coalesce(sum(total) filter (where status = 'paid'), 0),
          'voided_bills', count(*) filter (where status = 'voided')
        ) from in_range
      ),
      'by_day', (
        select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'bills', d.bills, 'net', d.net) order by d.day), '[]')
        from (
          select g::date as day, count(p.id) as bills, coalesce(sum(p.total), 0) as net
          from generate_series(p_from, p_to, interval '1 day') g
          left join paid p on public.session_date(p.created_at) = g::date
          group by g
        ) d
      ),
      'by_payment', (
        select jsonb_agg(jsonb_build_object('method', x.method, 'bills', x.bills, 'net', x.net) order by x.ord)
        from (
          select m.method, m.ord, count(p.id) as bills, coalesce(sum(p.total), 0) as net
          from (values ('cash', 1), ('transfer', 2), ('promptpay', 3)) m (method, ord)
          left join paid p on p.payment_method = m.method
          group by m.method, m.ord
        ) x
      ),
      'by_type', (
        select jsonb_build_object(
          'package', coalesce(sum(i.line_total) filter (where i.item_type = 'package'), 0),
          'product', coalesce(sum(i.line_total) filter (where i.item_type = 'product'), 0)
        )
        from public.sale_items i join paid p on p.id = i.sale_id
      )
    )
  );
end
$$;

create function public.report_checkins(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_report_owner();
  perform public.check_report_range(p_from, p_to);

  return (
    with c as (
      select * from public.check_ins where check_in_date between p_from and p_to
    )
    select jsonb_build_object(
      'total', (select count(*) from c),
      'unique_members', (select count(distinct member_id) from c),
      'by_day', (
        select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'total', d.total, 'unique_members', d.uniq) order by d.day), '[]')
        from (
          select g::date as day, count(c.id) as total, count(distinct c.member_id) as uniq
          from generate_series(p_from, p_to, interval '1 day') g
          left join c on c.check_in_date = g::date
          group by g
        ) d
      ),
      'by_hour', (
        select jsonb_agg(jsonb_build_object('hour', h.hour, 'total', h.total) order by h.hour)
        from (
          select g as hour, count(c.id) as total
          from generate_series(0, 23) g
          left join c on extract(hour from c.checked_in_at at time zone 'Asia/Bangkok') = g
          group by g
        ) h
      )
    )
  );
end
$$;

-- As of today: who can train, whose package runs out soon (and hasn't
-- renewed), and who lapsed in the last 30 days without buying again.
create function public.report_members() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := public.bangkok_today();
begin
  perform public.require_report_owner();

  return jsonb_build_object(
    'active_count', (
      select count(*) from public.members m where m.active and public.has_gym_access(m.id, v_today)
    ),
    'expiring', (
      select coalesce(jsonb_agg(to_jsonb(e) order by e.end_date, e.name), '[]')
      from (
        select distinct on (ms.member_id)
          ms.member_id, m.name, m.phone, pt.name as package_name, ms.end_date, ms.visits_left
        from public.memberships ms
        join public.members m on m.id = ms.member_id and m.active
        join public.package_types pt on pt.id = ms.package_type_id
        where ms.status = 'active' and ms.kind in ('duration', 'visits')
          and v_today between ms.start_date and ms.end_date
          and (ms.kind <> 'visits' or ms.visits_left > 0)
          and not public.is_frozen(ms.id, v_today)
          and (ms.end_date <= v_today + 6 or (ms.kind = 'visits' and ms.visits_left <= 2))
          -- Renewed = another usable gym package still runs past the 7-day window,
          -- even if it ends before this one (e.g. leftover visits + a new monthly).
          and not exists (
            select 1 from public.memberships o
            where o.member_id = ms.member_id and o.id <> ms.id and o.status = 'active'
              and o.kind in ('duration', 'visits') and o.end_date > v_today + 6
              and (o.kind <> 'visits' or o.visits_left > 2)
          )
        order by ms.member_id, ms.end_date
      ) e
    ),
    'expired_recent', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.last_end_date desc, x.name), '[]')
      from (
        -- Day passes are walk-ins, not lapsed members. A used-up visits pack
        -- ended on its last check-in (or yesterday), not on its end_date.
        select m.id as member_id, m.name, m.phone, max(x.ended) as last_end_date
        from public.members m
        join (
          select ms.member_id,
            case when ms.kind = 'visits' and ms.visits_left <= 0 then least(
              ms.end_date,
              coalesce((select max(c.check_in_date) from public.check_ins c where c.membership_id = ms.id), v_today - 1)
            ) else ms.end_date end as ended
          from public.memberships ms
          where ms.status = 'active' and ms.kind in ('duration', 'visits')
        ) x on x.member_id = m.id
        where m.active
          and not public.has_gym_access(m.id, v_today)
          and not exists (
            select 1 from public.memberships u
            where u.member_id = m.id and u.status = 'active'
              and u.kind in ('day', 'duration', 'visits') and u.start_date > v_today
          )
        group by m.id, m.name, m.phone
        having max(x.ended) between v_today - 30 and v_today - 1
      ) x
    )
  );
end
$$;

create function public.report_products(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_report_owner();
  perform public.check_report_range(p_from, p_to);

  return jsonb_build_object(
    'best_sellers', (
      select coalesce(jsonb_agg(to_jsonb(b) order by b.qty desc, b.amount desc), '[]')
      from (
        select i.product_id, max(i.name) as name, sum(i.qty)::int as qty, sum(i.line_total) as amount
        from public.sale_items i
        join public.sales s on s.id = i.sale_id and s.status = 'paid'
        where i.item_type = 'product' and public.session_date(s.created_at) between p_from and p_to
        group by i.product_id
        order by sum(i.qty) desc, sum(i.line_total) desc
        limit 20
      ) b
    ),
    'low_stock', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_id', p.id, 'name', p.name, 'stock_qty', p.stock_qty, 'low_stock_at', p.low_stock_at
      ) order by p.stock_qty, p.name), '[]')
      from public.products p
      where p.active and p.track_stock and p.stock_qty <= p.low_stock_at
    )
  );
end
$$;

create function public.report_overrides(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_report_owner();
  perform public.check_report_range(p_from, p_to);

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'checked_in_at', c.checked_in_at, 'member_name', m.name, 'reason', c.override_reason, 'staff_name', st.name
    ) order by c.checked_in_at desc), '[]')
    from public.check_ins c
    join public.members m on m.id = c.member_id
    left join public.staff st on st.id = c.created_by
    where c.override and c.check_in_date between p_from and p_to
  );
end
$$;

create function public.report_classes(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_report_owner();
  perform public.check_report_range(p_from, p_to);

  return jsonb_build_object(
    'sessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'starts_at', s.starts_at, 'class_name', ct.name, 'trainer_name', t.name,
        'capacity', s.capacity, 'cancelled', s.cancelled,
        'booked', (select count(*) from public.class_bookings b where b.class_session_id = s.id and b.status <> 'cancelled'),
        'attended', (select count(*) from public.class_bookings b where b.class_session_id = s.id and b.status = 'attended'),
        'no_show', (select count(*) from public.class_bookings b where b.class_session_id = s.id and b.status = 'no_show')
      ) order by s.starts_at), '[]')
      from public.class_sessions s
      join public.class_types ct on ct.id = s.class_type_id
      left join public.trainers t on t.id = s.trainer_id
      where public.session_date(s.starts_at) between p_from and p_to
    ),
    'pt_by_trainer', (
      select coalesce(jsonb_agg(jsonb_build_object('trainer_name', x.name, 'done', x.done) order by x.done desc, x.name), '[]')
      from (
        select t.name, count(*) as done
        from public.pt_appointments a
        join public.trainers t on t.id = a.trainer_id
        where a.status = 'done' and public.session_date(a.completed_at) between p_from and p_to
        group by t.name
      ) x
    )
  );
end
$$;

revoke execute on function public.report_sales(date, date) from public, anon;
revoke execute on function public.report_checkins(date, date) from public, anon;
revoke execute on function public.report_members() from public, anon;
revoke execute on function public.report_products(date, date) from public, anon;
revoke execute on function public.report_overrides(date, date) from public, anon;
revoke execute on function public.report_classes(date, date) from public, anon;
grant execute on function public.report_sales(date, date) to authenticated;
grant execute on function public.report_checkins(date, date) to authenticated;
grant execute on function public.report_members() to authenticated;
grant execute on function public.report_products(date, date) to authenticated;
grant execute on function public.report_overrides(date, date) to authenticated;
grant execute on function public.report_classes(date, date) to authenticated;

-- Spec §3/§7: staff see today's sales only. Enforced on the rows themselves so
-- the API can't be used to rebuild older days. get_receipt (public links) is
-- security definer and unaffected.
drop policy sales_select on public.sales;
create policy sales_select on public.sales for select to authenticated
  using (public.is_owner() or (public.is_staff() and public.session_date(created_at) = public.bangkok_today()));

drop policy sale_items_select on public.sale_items;
create policy sale_items_select on public.sale_items for select to authenticated
  using (
    public.is_owner()
    or (public.is_staff() and exists (
      select 1 from public.sales s
      where s.id = sale_id and public.session_date(s.created_at) = public.bangkok_today()
    ))
  );
