-- =====================================================================
-- DEMO / TEST DATA. Run once in the Supabase SQL Editor AFTER the migration.
-- Creates a test owner login, one staff PIN, a supplier and sample stock.
-- Do NOT run this on the live shop database.
--
--   Owner login:  owner@shreeram.test   /  Shreeram@123
--   Staff PIN:    1234  (Ramesh)
-- =====================================================================

-- 1. Test owner login (confirmed, email + password)
do $$
declare v_user uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where email = 'owner@shreeram.test') then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', 'owner@shreeram.test',
            extensions.crypt('Shreeram@123', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_user, v_user::text,
            jsonb_build_object('sub', v_user::text, 'email', 'owner@shreeram.test', 'email_verified', true),
            'email', now(), now(), now());
  end if;
end $$;

insert into public.owners (user_id)
select id from auth.users where email = 'owner@shreeram.test'
on conflict do nothing;

-- 2. Staff member with PIN 1234
insert into public.staff (name, pin_hash)
select 'Ramesh', extensions.crypt('1234', extensions.gen_salt('bf'))
where not exists (select 1 from public.staff where name = 'Ramesh');

-- 3. Shop details for the printed bill (sample values)
update public.shop_settings set gstin = '27ABCDE1234F1Z5', drug_license = '20B-MH-SAN-000000 / 21B-MH-SAN-000000' where id = 1;

-- 4. Supplier
insert into public.suppliers (name, phone, gstin, address, opening_balance)
values ('Sangli Pharma Distributors', '9800000000', '27AAAAA0000A1Z5', 'Sangli', 2500)
on conflict do nothing;

-- 5. Medicines with stock (MRP per pack; stock in loose units)
with p as (
  insert into public.products (name, company, packing, pack_size, hsn, gst_rate, barcode, reorder_level) values
    ('DOLO 650 TAB',      'MICRO LABS',  '15 TAB', 15, '3004', 12, '8901234500011', 10),
    ('BETAPOD 200 TAB',   'MANKIND',     '10 TAB', 10, '3004', 12, '8901234500028', 5),
    ('PAN 40 TAB',        'ALKEM',       '15 TAB', 15, '3004', 12, '8901234500035', 10),
    ('AZITHRAL 500 TAB',  'ALEMBIC',     '5 TAB',   5, '3004', 12, '8901234500042', 5),
    ('DICLOSAID GEL',     'SAIDAL',      '30 GM',   1, '3004', 18, '8901234500059', 5),
    ('ELECTRAL POWDER',   'FDC',         '21.8 GM', 1, '3004', 12, '8901234500066', 20),
    ('BENADRYL COUGH SYRUP', 'J&J',      '100 ML',  1, '3004', 12, '8901234500073', 5),
    ('CALCIUM VET LIQUID','VETCARE',     '1 LTR',   1, '3004', 5,  '8901234500080', 3)
  on conflict do nothing
  returning id, name, pack_size
)
insert into public.batches (product_id, batch_no, expiry, mrp, purchase_rate, stock_units)
select p.id, b.batch_no, b.expiry::date, b.mrp, b.rate, b.packs * p.pack_size
from p join (values
    ('DOLO 650 TAB',        'DL2405',  '2027-08-31', 33.60,  24.00, 40),
    ('DOLO 650 TAB',        'DL2311',  '2026-12-31', 32.00,  22.80, 6),
    ('BETAPOD 200 TAB',     'UCT-25466','2027-10-31', 164.00, 117.14, 12),
    ('PAN 40 TAB',          'PN8812',  '2028-01-31', 155.00, 105.00, 20),
    ('AZITHRAL 500 TAB',    'AZ5521',  '2027-03-31', 119.50,  82.00, 8),
    ('DICLOSAID GEL',       'OI1203',  '2028-07-31', 119.50,  85.00, 10),
    ('ELECTRAL POWDER',     'EL7781',  '2027-05-31', 22.00,  16.50, 50),
    ('BENADRYL COUGH SYRUP','BN3344',  '2026-12-31', 135.00,  98.00, 2),
    ('CALCIUM VET LIQUID',  'CV1010',  '2027-11-30', 450.00, 330.00, 6)
  ) as b(name, batch_no, expiry, mrp, rate, packs) on b.name = p.name;

-- 6. Salt / composition (for substitutes), two substitute brands, and udhaar customers
update public.products set composition = v.comp from (values
  ('DOLO 650 TAB', 'Paracetamol 650mg'), ('PAN 40 TAB', 'Pantoprazole 40mg'), ('AZITHRAL 500 TAB', 'Azithromycin 500mg'),
  ('BETAPOD 200 TAB', 'Cefpodoxime 200mg'), ('DICLOSAID GEL', 'Diclofenac gel'), ('ELECTRAL POWDER', 'Oral rehydration salts'),
  ('BENADRYL COUGH SYRUP', 'Diphenhydramine syrup')
) as v(name, comp) where public.products.name = v.name;

with p as (
  insert into public.products (name, company, packing, pack_size, hsn, gst_rate, barcode, reorder_level, composition) values
    ('CALPOL 650 TAB',   'GSK',          '15 TAB', 15, '3004', 12, '8901234500103', 5, 'Paracetamol 650mg'),
    ('PANTOCID 40 TAB',  'SUN PHARMA',   '15 TAB', 15, '3004', 12, '8901234500110', 5, 'Pantoprazole 40mg')
  on conflict do nothing
  returning id, name, pack_size
)
insert into public.batches (product_id, batch_no, expiry, mrp, purchase_rate, stock_units)
select p.id, b.batch_no, b.expiry::date, b.mrp, b.rate, b.packs * p.pack_size
from p join (values
    ('CALPOL 650 TAB',  'CP7710', '2028-02-29', 30.50, 21.50, 20),
    ('PANTOCID 40 TAB', 'PT3301', '2027-12-31', 148.00, 99.00, 10)
  ) as b(name, batch_no, expiry, mrp, rate, packs) on b.name = p.name;

insert into public.customers (name, phone, address, opening_balance) values
  ('Mahadev Jadhav', '9822111111', 'Arag', 300),
  ('Sunita Patil',   '9822000000', 'Arag', 0)
on conflict do nothing;

-- 7. Demo operator (counter staff) login: operator@shreeram.test / Operator@123
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'operators')
     and not exists (select 1 from auth.users where email = 'operator@shreeram.test') then
    perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'owner@shreeram.test'), true);
    perform public.create_operator('operator@shreeram.test', 'Operator@123', 'Counter 1');
  end if;
end $$;
