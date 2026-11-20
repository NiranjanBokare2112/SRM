-- =====================================================================
-- Shreeram Medical: billing schema (phase 1)
--
-- Design rules
--  * Only users listed in public.owners can read or write anything.
--  * Stock, bills and payments change ONLY through the security-definer
--    functions below, so a bill and its stock movement always commit together.
--  * Stock is tracked in loose units (e.g. tablets). A product's pack_size says
--    how many units are in one pack/strip; MRP and purchase rate are per pack.
--  * Sale MRP is GST-inclusive (Indian retail pharmacy practice); purchase rate
--    is GST-exclusive (as on supplier invoices).
--  * All money is rounded to 2 decimals per line; bill totals round to the
--    nearest rupee with the difference stored as round_off.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------
create table public.owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.owners where user_id = auth.uid()) $$;

create or replace function public.assert_owner()
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
end $$;

-- India Standard Time "today" and financial-year label (e.g. 26-27).
create or replace function public.ist_today()
returns date language sql stable
as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function public.financial_year(d date)
returns text language sql immutable
as $$
  select case when extract(month from d) >= 4
    then to_char(d, 'YY') || '-' || to_char(d + interval '1 year', 'YY')
    else to_char(d - interval '1 year', 'YY') || '-' || to_char(d, 'YY') end
$$;

-- Gap-free numbering per document type and financial year (GST invoices must be sequential).
create table public.doc_counters (
  kind text not null,
  fy text not null,
  last_no integer not null default 0,
  primary key (kind, fy)
);

create or replace function public.next_doc_no(p_kind text, p_fy text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v integer;
begin
  insert into public.doc_counters (kind, fy, last_no) values (p_kind, p_fy, 1)
  on conflict (kind, fy) do update set last_no = public.doc_counters.last_no + 1
  returning last_no into v;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Settings and staff
-- ---------------------------------------------------------------------
create table public.shop_settings (
  id integer primary key default 1 check (id = 1),
  shop_name text not null default 'Shreeram Medical',
  address text not null default 'Mahavir Chowk, Palavi Enterprises, Main Road, Post Arag, Taluka Miraj, Maharashtra 416401',
  phone text not null default '+91 77419 77111',
  gstin text not null default '',
  drug_license text not null default '',
  print_format text not null default 'a5' check (print_format in ('a5', 'thermal')),
  bill_footer text not null default 'Get well soon. Please check medicines and expiry before leaving the counter.',
  require_staff_pin boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.shop_settings default values;

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Masters
-- ---------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text not null default '',
  gstin text not null default '',
  address text not null default '',
  opening_balance numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index suppliers_name_key on public.suppliers (lower(name));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  company text not null default '',
  packing text not null default '',            -- display text, e.g. "10 TAB", "30 GM"
  pack_size integer not null default 1 check (pack_size between 1 and 1000),
  hsn text not null default '',
  gst_rate numeric(5,2) not null default 12 check (gst_rate in (0, 5, 12, 18, 28)),
  barcode text unique,
  reorder_level integer not null default 0 check (reorder_level >= 0), -- in packs
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index products_name_packing_key on public.products (lower(name), lower(packing));
create index products_name_idx on public.products (lower(name) text_pattern_ops);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  batch_no text not null check (length(trim(batch_no)) > 0),
  expiry date not null,                         -- stored as the last day of the expiry month
  mrp numeric(10,2) not null check (mrp > 0),   -- per pack, GST inclusive
  purchase_rate numeric(10,2) not null default 0 check (purchase_rate >= 0), -- per pack, net of discount, GST exclusive
  stock_units integer not null default 0 check (stock_units >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, batch_no)
);
create index batches_product_idx on public.batches (product_id, expiry);

-- ---------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  fy text not null,
  bill_no integer not null,
  bill_date date not null default public.ist_today(),
  created_at timestamptz not null default now(),
  staff_id uuid references public.staff(id),
  staff_name text not null default 'Owner',
  patient_name text not null default '',
  patient_phone text not null default '',
  doctor_name text not null default '',
  payment_mode text not null check (payment_mode in ('cash', 'upi', 'card', 'credit')),
  gross numeric(12,2) not null,       -- sum of line MRP amounts
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  discount numeric(12,2) not null default 0,
  taxable numeric(12,2) not null,
  gst numeric(12,2) not null,
  round_off numeric(6,2) not null default 0,
  net numeric(12,2) not null,
  cost numeric(12,2) not null default 0,       -- purchase cost of goods, for profit
  returned_amount numeric(12,2) not null default 0,
  unique (fy, bill_no)
);
create index sales_date_idx on public.sales (bill_date desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  batch_id uuid not null references public.batches(id),
  product_name text not null,
  packing text not null,
  pack_size integer not null,
  batch_no text not null,
  expiry date not null,
  mrp numeric(10,2) not null,
  gst_rate numeric(5,2) not null,
  units integer not null check (units > 0),
  amount numeric(12,2) not null,        -- before bill discount
  net_amount numeric(12,2) not null,    -- after bill discount, GST inclusive
  taxable numeric(12,2) not null,
  gst numeric(12,2) not null,
  cost numeric(12,2) not null,
  returned_units integer not null default 0 check (returned_units >= 0 and returned_units <= units)
);
create index sale_items_sale_idx on public.sale_items (sale_id);

create table public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  fy text not null,
  return_no integer not null,
  return_date date not null default public.ist_today(),
  created_at timestamptz not null default now(),
  sale_id uuid not null references public.sales(id),
  refund_mode text not null check (refund_mode in ('cash', 'upi', 'card', 'credit')),
  taxable numeric(12,2) not null,
  gst numeric(12,2) not null,
  amount numeric(12,2) not null,
  cost numeric(12,2) not null,
  note text not null default '',
  unique (fy, return_no)
);

create table public.sales_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sales_returns(id) on delete cascade,
  sale_item_id uuid not null references public.sale_items(id),
  units integer not null check (units > 0),
  amount numeric(12,2) not null,
  taxable numeric(12,2) not null,
  gst numeric(12,2) not null,
  gst_rate numeric(5,2) not null
);

-- ---------------------------------------------------------------------
-- Purchases and supplier payments
-- ---------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  fy text not null,
  entry_no integer not null,
  bill_date date not null,
  created_at timestamptz not null default now(),
  supplier_id uuid not null references public.suppliers(id),
  supplier_bill_no text not null check (length(trim(supplier_bill_no)) > 0),
  payment_mode text not null check (payment_mode in ('cash', 'credit')),
  gross numeric(12,2) not null,
  discount numeric(12,2) not null,
  taxable numeric(12,2) not null,
  gst numeric(12,2) not null,
  adjustment numeric(12,2) not null default 0,   -- freight/TCS (+) or credit note (-)
  round_off numeric(6,2) not null default 0,
  net numeric(12,2) not null,
  narration text not null default '',
  unique (fy, entry_no),
  unique (supplier_id, supplier_bill_no)
);
create index purchases_date_idx on public.purchases (bill_date desc);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id),
  batch_id uuid not null references public.batches(id),
  product_name text not null,
  batch_no text not null,
  expiry date not null,
  mrp numeric(10,2) not null,
  rate numeric(10,2) not null,
  qty integer not null check (qty >= 0),
  free_qty integer not null default 0 check (free_qty >= 0),
  discount_pct numeric(5,2) not null default 0,
  gst_rate numeric(5,2) not null,
  gross numeric(12,2) not null,
  discount numeric(12,2) not null,
  taxable numeric(12,2) not null,
  gst numeric(12,2) not null,
  amount numeric(12,2) not null,
  check (qty + free_qty > 0)
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  payment_date date not null default public.ist_today(),
  created_at timestamptz not null default now(),
  supplier_id uuid not null references public.suppliers(id),
  amount numeric(12,2) not null check (amount > 0),
  mode text not null check (mode in ('cash', 'upi', 'cheque', 'bank')),
  note text not null default ''
);

create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  adjust_date date not null default public.ist_today(),
  batch_id uuid not null references public.batches(id),
  units integer not null check (units <> 0),   -- negative removes stock
  reason text not null check (reason in ('expired', 'damaged', 'returned_to_supplier', 'count_correction', 'opening_stock')),
  note text not null default ''
);

-- ---------------------------------------------------------------------
-- Row level security: owners only. Transaction tables are read-only to
-- clients; they are written by the functions below.
-- ---------------------------------------------------------------------
alter table public.owners enable row level security;
alter table public.doc_counters enable row level security;
alter table public.shop_settings enable row level security;
alter table public.staff enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.batches enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sales_returns enable row level security;
alter table public.sales_return_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.stock_adjustments enable row level security;

create policy owners_read_self on public.owners for select to authenticated using (user_id = auth.uid());

create policy settings_read on public.shop_settings for select to authenticated using (public.is_owner());
create policy settings_update on public.shop_settings for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy staff_read on public.staff for select to authenticated using (public.is_owner());

create policy suppliers_read on public.suppliers for select to authenticated using (public.is_owner());
create policy suppliers_insert on public.suppliers for insert to authenticated with check (public.is_owner());
create policy suppliers_update on public.suppliers for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy products_read on public.products for select to authenticated using (public.is_owner());
create policy products_insert on public.products for insert to authenticated with check (public.is_owner());
create policy products_update on public.products for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy batches_read on public.batches for select to authenticated using (public.is_owner());
create policy sales_read on public.sales for select to authenticated using (public.is_owner());
create policy sale_items_read on public.sale_items for select to authenticated using (public.is_owner());
create policy sales_returns_read on public.sales_returns for select to authenticated using (public.is_owner());
create policy sales_return_items_read on public.sales_return_items for select to authenticated using (public.is_owner());
create policy purchases_read on public.purchases for select to authenticated using (public.is_owner());
create policy purchase_items_read on public.purchase_items for select to authenticated using (public.is_owner());
create policy supplier_payments_read on public.supplier_payments for select to authenticated using (public.is_owner());
create policy stock_adjustments_read on public.stock_adjustments for select to authenticated using (public.is_owner());

-- Clients never see PIN hashes.
revoke all on public.staff from anon, authenticated;
grant select (id, name, active, created_at) on public.staff to authenticated;
revoke all on public.doc_counters from anon, authenticated;
revoke insert, update, delete on public.batches, public.sales, public.sale_items, public.sales_returns,
  public.sales_return_items, public.purchases, public.purchase_items, public.supplier_payments,
  public.stock_adjustments from anon, authenticated;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.month_end(p_year integer, p_month integer)
returns date language sql immutable
as $$ select (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date $$;

-- Resolve a staff PIN to (id, name). Returns null when the PIN is empty and PINs are optional.
create or replace function public.resolve_staff(p_pin text, out staff_id uuid, out staff_name text)
language plpgsql security definer set search_path = public, extensions
as $$
declare v_required boolean;
begin
  select require_staff_pin into v_required from public.shop_settings where id = 1;
  if coalesce(trim(p_pin), '') = '' then
    if v_required and exists (select 1 from public.staff where active) then
      raise exception 'Enter the staff PIN' using errcode = 'P0001';
    end if;
    staff_id := null; staff_name := 'Owner';
    return;
  end if;
  select s.id, s.name into staff_id, staff_name
  from public.staff s
  where s.active and s.pin_hash = extensions.crypt(trim(p_pin), s.pin_hash)
  limit 1;
  if staff_id is null then
    raise exception 'Wrong staff PIN' using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Staff management
-- ---------------------------------------------------------------------
create or replace function public.save_staff(p_id uuid, p_name text, p_pin text, p_active boolean)
returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare v_id uuid;
begin
  perform public.assert_owner();
  if coalesce(trim(p_name), '') = '' then raise exception 'Enter the staff name' using errcode = 'P0001'; end if;
  if p_pin is not null and trim(p_pin) !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4 to 6 digits' using errcode = 'P0001';
  end if;
  if p_pin is not null and exists (
    select 1 from public.staff s
    where s.active and s.id is distinct from p_id and s.pin_hash = extensions.crypt(trim(p_pin), s.pin_hash)
  ) then
    raise exception 'Another staff member already uses this PIN' using errcode = 'P0001';
  end if;

  if p_id is null then
    if p_pin is null then raise exception 'Set a PIN for the new staff member' using errcode = 'P0001'; end if;
    insert into public.staff (name, pin_hash, active)
    values (trim(p_name), extensions.crypt(trim(p_pin), extensions.gen_salt('bf')), coalesce(p_active, true))
    returning id into v_id;
  else
    update public.staff set
      name = trim(p_name),
      active = coalesce(p_active, active),
      pin_hash = case when p_pin is null then pin_hash else extensions.crypt(trim(p_pin), extensions.gen_salt('bf')) end
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Staff member not found' using errcode = 'P0001'; end if;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Sales bill
-- p: { pin, patient_name, patient_phone, doctor_name, payment_mode,
--      discount_pct, items: [ { batch_id, units } ] }
-- ---------------------------------------------------------------------
create or replace function public.create_sale(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_staff record;
  v_sale_id uuid;
  v_today date := public.ist_today();
  v_fy text := public.financial_year(public.ist_today());
  v_bill_no integer;
  v_disc_pct numeric := coalesce((p->>'discount_pct')::numeric, 0);
  v_item jsonb;
  v_units integer;
  b record;
  v_amount numeric; v_net numeric; v_taxable numeric; v_gst numeric; v_cost numeric;
  t_gross numeric := 0; t_net numeric := 0; t_taxable numeric := 0; t_gst numeric := 0; t_cost numeric := 0;
  v_rounded numeric;
begin
  perform public.assert_owner();
  if v_disc_pct < 0 or v_disc_pct > 100 then raise exception 'Discount must be between 0 and 100%%' using errcode = 'P0001'; end if;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'Add at least one medicine to the bill' using errcode = 'P0001';
  end if;
  if coalesce(p->>'payment_mode', '') not in ('cash', 'upi', 'card', 'credit') then
    raise exception 'Choose a payment mode' using errcode = 'P0001';
  end if;
  if p->>'payment_mode' = 'credit' and coalesce(trim(p->>'patient_name'), '') = '' then
    raise exception 'Enter the customer name for a credit (udhaar) bill' using errcode = 'P0001';
  end if;

  select * into v_staff from public.resolve_staff(p->>'pin');
  v_bill_no := public.next_doc_no('sale', v_fy);

  insert into public.sales (fy, bill_no, bill_date, staff_id, staff_name, patient_name, patient_phone, doctor_name,
                            payment_mode, gross, discount_pct, discount, taxable, gst, round_off, net, cost)
  values (v_fy, v_bill_no, v_today, v_staff.staff_id, v_staff.staff_name,
          coalesce(trim(p->>'patient_name'), ''), coalesce(trim(p->>'patient_phone'), ''), coalesce(trim(p->>'doctor_name'), ''),
          p->>'payment_mode', 0, v_disc_pct, 0, 0, 0, 0, 0, 0)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_units := (v_item->>'units')::integer;
    if v_units is null or v_units <= 0 then raise exception 'Quantity must be more than zero' using errcode = 'P0001'; end if;

    select bt.*, pr.name as product_name, pr.packing, pr.pack_size, pr.gst_rate
      into b
      from public.batches bt join public.products pr on pr.id = bt.product_id
     where bt.id = (v_item->>'batch_id')::uuid
     for update of bt;
    if not found then raise exception 'Batch not found' using errcode = 'P0001'; end if;
    if b.expiry < v_today then
      raise exception '% (batch %) has expired', b.product_name, b.batch_no using errcode = 'P0001';
    end if;
    if b.stock_units < v_units then
      raise exception 'Only % units of % (batch %) in stock', b.stock_units, b.product_name, b.batch_no using errcode = 'P0001';
    end if;

    v_amount  := round(b.mrp * v_units / b.pack_size, 2);
    v_net     := round(v_amount * (1 - v_disc_pct / 100), 2);
    v_taxable := round(v_net / (1 + b.gst_rate / 100), 2);
    v_gst     := v_net - v_taxable;
    v_cost    := round(b.purchase_rate * v_units / b.pack_size, 2);

    update public.batches set stock_units = stock_units - v_units where id = b.id;

    insert into public.sale_items (sale_id, product_id, batch_id, product_name, packing, pack_size, batch_no, expiry,
                                   mrp, gst_rate, units, amount, net_amount, taxable, gst, cost)
    values (v_sale_id, b.product_id, b.id, b.product_name, b.packing, b.pack_size, b.batch_no, b.expiry,
            b.mrp, b.gst_rate, v_units, v_amount, v_net, v_taxable, v_gst, v_cost);

    t_gross := t_gross + v_amount; t_net := t_net + v_net; t_taxable := t_taxable + v_taxable;
    t_gst := t_gst + v_gst; t_cost := t_cost + v_cost;
  end loop;

  v_rounded := round(t_net, 0);
  update public.sales set gross = t_gross, discount = t_gross - t_net, taxable = t_taxable, gst = t_gst,
                          round_off = v_rounded - t_net, net = v_rounded, cost = t_cost
   where id = v_sale_id;

  return jsonb_build_object('id', v_sale_id, 'bill_no', v_bill_no, 'fy', v_fy, 'net', v_rounded);
end $$;

-- ---------------------------------------------------------------------
-- Sales return (against an existing bill)
-- p: { sale_id, refund_mode, note, items: [ { sale_item_id, units } ] }
-- ---------------------------------------------------------------------
create or replace function public.create_sales_return(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_return_id uuid;
  v_fy text := public.financial_year(public.ist_today());
  v_no integer;
  v_item jsonb;
  v_units integer;
  si record;
  v_amount numeric; v_taxable numeric; v_gst numeric; v_cost numeric;
  t_amount numeric := 0; t_taxable numeric := 0; t_gst numeric := 0; t_cost numeric := 0;
begin
  perform public.assert_owner();
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'Select at least one item to return' using errcode = 'P0001';
  end if;
  if coalesce(p->>'refund_mode', '') not in ('cash', 'upi', 'card', 'credit') then
    raise exception 'Choose a refund mode' using errcode = 'P0001';
  end if;
  perform 1 from public.sales where id = (p->>'sale_id')::uuid for update;
  if not found then raise exception 'Bill not found' using errcode = 'P0001'; end if;

  v_no := public.next_doc_no('sales_return', v_fy);
  insert into public.sales_returns (fy, return_no, sale_id, refund_mode, taxable, gst, amount, cost, note)
  values (v_fy, v_no, (p->>'sale_id')::uuid, p->>'refund_mode', 0, 0, 0, 0, coalesce(trim(p->>'note'), ''))
  returning id into v_return_id;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_units := (v_item->>'units')::integer;
    if v_units is null or v_units <= 0 then continue; end if;
    select * into si from public.sale_items
     where id = (v_item->>'sale_item_id')::uuid and sale_id = (p->>'sale_id')::uuid for update;
    if not found then raise exception 'Item does not belong to this bill' using errcode = 'P0001'; end if;
    if si.returned_units + v_units > si.units then
      raise exception 'Only % units of % can still be returned', si.units - si.returned_units, si.product_name using errcode = 'P0001';
    end if;

    -- Refund what the customer actually paid for these units (after bill discount).
    v_amount  := round(si.net_amount * v_units / si.units, 2);
    v_taxable := round(v_amount / (1 + si.gst_rate / 100), 2);
    v_gst     := v_amount - v_taxable;
    v_cost    := round(si.cost * v_units / si.units, 2);

    update public.sale_items set returned_units = returned_units + v_units where id = si.id;
    update public.batches set stock_units = stock_units + v_units where id = si.batch_id;
    insert into public.sales_return_items (return_id, sale_item_id, units, amount, taxable, gst, gst_rate)
    values (v_return_id, si.id, v_units, v_amount, v_taxable, v_gst, si.gst_rate);

    t_amount := t_amount + v_amount; t_taxable := t_taxable + v_taxable; t_gst := t_gst + v_gst; t_cost := t_cost + v_cost;
  end loop;

  if t_amount = 0 then raise exception 'Select at least one item to return' using errcode = 'P0001'; end if;

  update public.sales_returns set amount = t_amount, taxable = t_taxable, gst = t_gst, cost = t_cost where id = v_return_id;
  update public.sales set returned_amount = returned_amount + t_amount where id = (p->>'sale_id')::uuid;
  return jsonb_build_object('id', v_return_id, 'return_no', v_no, 'fy', v_fy, 'amount', t_amount);
end $$;

-- ---------------------------------------------------------------------
-- Purchase bill
-- p: { supplier_id, supplier_bill_no, bill_date, payment_mode, adjustment, narration,
--      items: [ { product_id, batch_no, expiry_month, expiry_year, mrp, rate, qty, free_qty, discount_pct } ] }
-- qty / free_qty are in packs. GST rate comes from the product.
-- ---------------------------------------------------------------------
create or replace function public.create_purchase(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_date date := coalesce((p->>'bill_date')::date, public.ist_today());
  v_fy text;
  v_no integer;
  v_item jsonb;
  pr record;
  v_batch_id uuid;
  v_expiry date;
  v_qty integer; v_free integer; v_rate numeric; v_mrp numeric; v_disc_pct numeric;
  v_gross numeric; v_disc numeric; v_taxable numeric; v_gst numeric; v_net_rate numeric;
  t_gross numeric := 0; t_disc numeric := 0; t_taxable numeric := 0; t_gst numeric := 0;
  v_adjust numeric := coalesce((p->>'adjustment')::numeric, 0);
  v_total numeric; v_rounded numeric;
begin
  perform public.assert_owner();
  if v_date > public.ist_today() then raise exception 'Bill date cannot be in the future' using errcode = 'P0001'; end if;
  v_fy := public.financial_year(v_date);
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'Add at least one item' using errcode = 'P0001';
  end if;
  if coalesce(p->>'payment_mode', '') not in ('cash', 'credit') then
    raise exception 'Choose cash or credit' using errcode = 'P0001';
  end if;
  if coalesce(trim(p->>'supplier_bill_no'), '') = '' then
    raise exception 'Enter the supplier bill number' using errcode = 'P0001';
  end if;
  perform 1 from public.suppliers where id = (p->>'supplier_id')::uuid;
  if not found then raise exception 'Choose a supplier' using errcode = 'P0001'; end if;
  if exists (select 1 from public.purchases where supplier_id = (p->>'supplier_id')::uuid
             and lower(supplier_bill_no) = lower(trim(p->>'supplier_bill_no'))) then
    raise exception 'This supplier bill number is already entered' using errcode = 'P0001';
  end if;

  v_no := public.next_doc_no('purchase', v_fy);
  insert into public.purchases (fy, entry_no, bill_date, supplier_id, supplier_bill_no, payment_mode,
                                gross, discount, taxable, gst, adjustment, round_off, net, narration)
  values (v_fy, v_no, v_date, (p->>'supplier_id')::uuid, trim(p->>'supplier_bill_no'), p->>'payment_mode',
          0, 0, 0, 0, v_adjust, 0, 0, coalesce(trim(p->>'narration'), ''))
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    select * into pr from public.products where id = (v_item->>'product_id')::uuid;
    if not found then raise exception 'Product not found' using errcode = 'P0001'; end if;

    v_qty := coalesce((v_item->>'qty')::integer, 0);
    v_free := coalesce((v_item->>'free_qty')::integer, 0);
    v_rate := coalesce((v_item->>'rate')::numeric, 0);
    v_mrp := (v_item->>'mrp')::numeric;
    v_disc_pct := coalesce((v_item->>'discount_pct')::numeric, 0);
    if v_qty < 0 or v_free < 0 or v_qty + v_free = 0 then
      raise exception 'Enter a quantity for %', pr.name using errcode = 'P0001';
    end if;
    if v_mrp is null or v_mrp <= 0 then raise exception 'Enter the MRP for %', pr.name using errcode = 'P0001'; end if;
    if v_rate < 0 or v_disc_pct < 0 or v_disc_pct > 100 then
      raise exception 'Check the rate and discount for %', pr.name using errcode = 'P0001';
    end if;
    if coalesce(trim(v_item->>'batch_no'), '') = '' then
      raise exception 'Enter the batch number for %', pr.name using errcode = 'P0001';
    end if;
    v_expiry := public.month_end((v_item->>'expiry_year')::integer, (v_item->>'expiry_month')::integer);

    v_gross := round(v_rate * v_qty, 2);
    v_disc := round(v_gross * v_disc_pct / 100, 2);
    v_taxable := v_gross - v_disc;
    v_gst := round(v_taxable * pr.gst_rate / 100, 2);
    -- Effective cost per pack including free goods, used for profit reports.
    v_net_rate := case when v_qty + v_free > 0 then round(v_taxable / (v_qty + v_free), 2) else 0 end;

    insert into public.batches (product_id, batch_no, expiry, mrp, purchase_rate, stock_units)
    values (pr.id, upper(trim(v_item->>'batch_no')), v_expiry, v_mrp, v_net_rate, (v_qty + v_free) * pr.pack_size)
    on conflict (product_id, batch_no) do update set
      expiry = excluded.expiry,
      mrp = excluded.mrp,
      purchase_rate = excluded.purchase_rate,
      stock_units = public.batches.stock_units + excluded.stock_units
    returning id into v_batch_id;

    insert into public.purchase_items (purchase_id, product_id, batch_id, product_name, batch_no, expiry, mrp, rate,
                                       qty, free_qty, discount_pct, gst_rate, gross, discount, taxable, gst, amount)
    values (v_id, pr.id, v_batch_id, pr.name, upper(trim(v_item->>'batch_no')), v_expiry, v_mrp, v_rate,
            v_qty, v_free, v_disc_pct, pr.gst_rate, v_gross, v_disc, v_taxable, v_gst, v_taxable + v_gst);

    t_gross := t_gross + v_gross; t_disc := t_disc + v_disc; t_taxable := t_taxable + v_taxable; t_gst := t_gst + v_gst;
  end loop;

  v_total := t_taxable + t_gst + v_adjust;
  v_rounded := round(v_total, 0);
  update public.purchases set gross = t_gross, discount = t_disc, taxable = t_taxable, gst = t_gst,
                              round_off = v_rounded - v_total, net = v_rounded
   where id = v_id;
  return jsonb_build_object('id', v_id, 'entry_no', v_no, 'fy', v_fy, 'net', v_rounded);
end $$;

-- ---------------------------------------------------------------------
-- Supplier payment and stock adjustment
-- ---------------------------------------------------------------------
create or replace function public.record_supplier_payment(p_supplier_id uuid, p_amount numeric, p_mode text, p_note text, p_date date default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  perform public.assert_owner();
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount' using errcode = 'P0001'; end if;
  if coalesce(p_date, public.ist_today()) > public.ist_today() then raise exception 'Payment date cannot be in the future' using errcode = 'P0001'; end if;
  insert into public.supplier_payments (supplier_id, amount, mode, note, payment_date)
  values (p_supplier_id, round(p_amount, 2), p_mode, coalesce(trim(p_note), ''), coalesce(p_date, public.ist_today()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.adjust_stock(p_batch_id uuid, p_units integer, p_reason text, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_stock integer;
begin
  perform public.assert_owner();
  if p_units is null or p_units = 0 then raise exception 'Enter a quantity' using errcode = 'P0001'; end if;
  select stock_units into v_stock from public.batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found' using errcode = 'P0001'; end if;
  if v_stock + p_units < 0 then raise exception 'Only % units in stock', v_stock using errcode = 'P0001'; end if;
  update public.batches set stock_units = stock_units + p_units where id = p_batch_id;
  insert into public.stock_adjustments (batch_id, units, reason, note) values (p_batch_id, p_units, p_reason, coalesce(trim(p_note), ''));
end $$;

-- Add opening stock for a product that is already on the shelf (no purchase bill).
create or replace function public.add_opening_stock(p_product_id uuid, p_batch_no text, p_expiry_month integer, p_expiry_year integer,
                                                    p_mrp numeric, p_purchase_rate numeric, p_packs integer, p_loose integer default 0)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_pack_size integer; v_units integer; v_batch uuid;
begin
  perform public.assert_owner();
  select pack_size into v_pack_size from public.products where id = p_product_id;
  if not found then raise exception 'Product not found' using errcode = 'P0001'; end if;
  if coalesce(trim(p_batch_no), '') = '' then raise exception 'Enter the batch number' using errcode = 'P0001'; end if;
  if p_mrp is null or p_mrp <= 0 then raise exception 'Enter the MRP' using errcode = 'P0001'; end if;
  v_units := coalesce(p_packs, 0) * v_pack_size + coalesce(p_loose, 0);
  if v_units <= 0 then raise exception 'Enter a quantity' using errcode = 'P0001'; end if;

  insert into public.batches (product_id, batch_no, expiry, mrp, purchase_rate, stock_units)
  values (p_product_id, upper(trim(p_batch_no)), public.month_end(p_expiry_year, p_expiry_month), p_mrp, coalesce(p_purchase_rate, 0), 0)
  on conflict (product_id, batch_no) do update set expiry = excluded.expiry, mrp = excluded.mrp,
    purchase_rate = case when excluded.purchase_rate > 0 then excluded.purchase_rate else public.batches.purchase_rate end
  returning id into v_batch;

  update public.batches set stock_units = stock_units + v_units where id = v_batch;
  insert into public.stock_adjustments (batch_id, units, reason, note) values (v_batch, v_units, 'opening_stock', '');
  return v_batch;
end $$;

-- ---------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------
create or replace view public.supplier_balances
with (security_invoker = true) as
select s.id, s.name, s.phone,
  s.opening_balance
  + coalesce((select sum(net) from public.purchases pu where pu.supplier_id = s.id and pu.payment_mode = 'credit'), 0)
  - coalesce((select sum(amount) from public.supplier_payments sp where sp.supplier_id = s.id), 0) as balance
from public.suppliers s;

create or replace view public.product_stock
with (security_invoker = true) as
select pr.id, pr.name, pr.company, pr.packing, pr.pack_size, pr.gst_rate, pr.barcode, pr.reorder_level, pr.active,
  coalesce(sum(b.stock_units) filter (where b.expiry >= public.ist_today()), 0)::integer as stock_units,
  coalesce(sum(b.stock_units) filter (where b.expiry < public.ist_today()), 0)::integer as expired_units,
  min(b.expiry) filter (where b.stock_units > 0 and b.expiry >= public.ist_today()) as next_expiry,
  coalesce(sum(round(b.purchase_rate * b.stock_units / pr.pack_size, 2)), 0) as stock_value
from public.products pr
left join public.batches b on b.product_id = pr.id
group by pr.id;

create or replace function public.sales_summary(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v jsonb;
begin
  perform public.assert_owner();
  select jsonb_build_object(
    'bills', count(*),
    'gross', coalesce(sum(gross), 0),
    'discount', coalesce(sum(discount), 0),
    'net', coalesce(sum(net), 0),
    'gst', coalesce(sum(gst), 0),
    'cost', coalesce(sum(cost), 0),
    'taxable', coalesce(sum(taxable), 0),
    'by_mode', coalesce((select jsonb_object_agg(payment_mode, total) from (
        select payment_mode, sum(net) as total from public.sales
        where bill_date between p_from and p_to group by payment_mode) m), '{}'::jsonb),
    'returns', coalesce((select sum(amount) from public.sales_returns where return_date between p_from and p_to), 0),
    'returns_taxable', coalesce((select sum(taxable) from public.sales_returns where return_date between p_from and p_to), 0),
    'returns_cost', coalesce((select sum(cost) from public.sales_returns where return_date between p_from and p_to), 0),
    'purchases', coalesce((select sum(net) from public.purchases where bill_date between p_from and p_to), 0)
  ) into v
  from public.sales where bill_date between p_from and p_to;
  return v;
end $$;

create or replace function public.gst_summary(p_from date, p_to date)
returns table (gst_rate numeric, sales_taxable numeric, sales_gst numeric, purchase_taxable numeric, purchase_gst numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.assert_owner();
  return query
  with s as (
    select si.gst_rate, sum(si.taxable) as taxable, sum(si.gst) as gst
    from public.sale_items si join public.sales sa on sa.id = si.sale_id
    where sa.bill_date between p_from and p_to group by si.gst_rate
  ), r as (
    select ri.gst_rate, sum(ri.taxable) as taxable, sum(ri.gst) as gst
    from public.sales_return_items ri join public.sales_returns sr on sr.id = ri.return_id
    where sr.return_date between p_from and p_to group by ri.gst_rate
  ), pu as (
    select pi.gst_rate, sum(pi.taxable) as taxable, sum(pi.gst) as gst
    from public.purchase_items pi join public.purchases p on p.id = pi.purchase_id
    where p.bill_date between p_from and p_to group by pi.gst_rate
  ), rates as (select s.gst_rate from s union select r.gst_rate from r union select pu.gst_rate from pu)
  select rates.gst_rate,
    coalesce(s.taxable, 0) - coalesce(r.taxable, 0),
    coalesce(s.gst, 0) - coalesce(r.gst, 0),
    coalesce(pu.taxable, 0),
    coalesce(pu.gst, 0)
  from rates
  left join s on s.gst_rate = rates.gst_rate
  left join r on r.gst_rate = rates.gst_rate
  left join pu on pu.gst_rate = rates.gst_rate
  order by rates.gst_rate;
end $$;

-- ---------------------------------------------------------------------
-- Function privileges: only signed-in users may call them; each one also checks is_owner().
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_owner(), public.save_staff(uuid, text, text, boolean), public.create_sale(jsonb),
  public.create_sales_return(jsonb), public.create_purchase(jsonb),
  public.record_supplier_payment(uuid, numeric, text, text, date), public.adjust_stock(uuid, integer, text, text),
  public.add_opening_stock(uuid, text, integer, integer, numeric, numeric, integer, integer),
  public.sales_summary(date, date), public.gst_summary(date, date), public.ist_today(), public.financial_year(date)
  to authenticated;
-- Internal helpers are not callable directly by clients.
revoke execute on function public.next_doc_no(text, text), public.resolve_staff(text), public.assert_owner() from authenticated;
