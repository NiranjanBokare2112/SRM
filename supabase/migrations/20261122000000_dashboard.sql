-- =====================================================================
-- Dashboard figures for a date range, computed in one call.
-- "Sales" everywhere here means bill totals minus refunds, matching Reports.
-- =====================================================================

create or replace function public.dashboard_stats(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_days integer := (p_to - p_from) + 1;
  v_prev_from date := p_from - ((p_to - p_from) + 1);
  v_prev_to date := p_from - 1;
  v jsonb;
begin
  perform public.assert_owner();
  if p_to < p_from then raise exception 'The end date is before the start date' using errcode = 'P0001'; end if;
  if v_days > 400 then raise exception 'Choose a range of 400 days or less' using errcode = 'P0001'; end if;

  with
  s as (select * from public.sales where bill_date between p_from and p_to),
  r as (select * from public.sales_returns where return_date between p_from and p_to),
  ps as (select * from public.sales where bill_date between v_prev_from and v_prev_to),
  pr as (select * from public.sales_returns where return_date between v_prev_from and v_prev_to),
  days as (select d::date as day from generate_series(p_from, p_to, interval '1 day') d),
  daily as (
    select days.day,
      coalesce((select sum(net) from s where s.bill_date = days.day), 0)
        - coalesce((select sum(amount) from r where r.return_date = days.day), 0) as net,
      coalesce((select count(*) from s where s.bill_date = days.day), 0) as bills,
      coalesce((select sum(taxable - cost) from s where s.bill_date = days.day), 0)
        - coalesce((select sum(taxable - cost) from r where r.return_date = days.day), 0) as profit
    from days
  ),
  hours as (select h from generate_series(0, 23) h),
  hourly as (
    select hours.h as hour,
      coalesce(sum(s.net), 0) as net,
      count(s.id) as bills
    from hours
    left join s on extract(hour from s.created_at at time zone 'Asia/Kolkata') = hours.h
    group by hours.h
  ),
  top as (
    select si.product_id, si.product_name as name, si.packing, si.pack_size,
      sum(si.units - si.returned_units) as units,
      sum(round(si.net_amount * (si.units - si.returned_units) / si.units, 2)) as amount
    from public.sale_items si join s on s.id = si.sale_id
    group by si.product_id, si.product_name, si.packing, si.pack_size
    having sum(si.units - si.returned_units) > 0
    order by amount desc, name
    limit 8
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'previous_from', v_prev_from, 'previous_to', v_prev_to,
    'totals', jsonb_build_object(
      'net', coalesce((select sum(net) from s), 0) - coalesce((select sum(amount) from r), 0),
      'bills', (select count(*) from s),
      'profit', coalesce((select sum(taxable - cost) from s), 0) - coalesce((select sum(taxable - cost) from r), 0),
      'returns', coalesce((select sum(amount) from r), 0)
    ),
    'previous', jsonb_build_object(
      'net', coalesce((select sum(net) from ps), 0) - coalesce((select sum(amount) from pr), 0),
      'bills', (select count(*) from ps),
      'profit', coalesce((select sum(taxable - cost) from ps), 0) - coalesce((select sum(taxable - cost) from pr), 0)
    ),
    'by_mode', jsonb_build_object(
      'cash', coalesce((select sum(net) from s where payment_mode = 'cash'), 0),
      'upi', coalesce((select sum(net) from s where payment_mode = 'upi'), 0),
      'card', coalesce((select sum(net) from s where payment_mode = 'card'), 0),
      'credit', coalesce((select sum(net) from s where payment_mode = 'credit'), 0)
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'net', net, 'bills', bills, 'profit', profit) order by day) from daily), '[]'::jsonb),
    'hourly', coalesce((select jsonb_agg(jsonb_build_object('hour', hour, 'net', net, 'bills', bills) order by hour) from hourly), '[]'::jsonb),
    'top_products', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'packing', packing, 'pack_size', pack_size, 'units', units, 'amount', amount) order by amount desc, name) from top), '[]'::jsonb)
  ) into v;
  return v;
end $$;

revoke execute on function public.dashboard_stats(date, date) from public, anon;
grant execute on function public.dashboard_stats(date, date) to authenticated;
