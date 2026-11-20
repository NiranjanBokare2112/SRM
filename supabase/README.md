# Billing database setup (Supabase)

The owner billing portal (`/admin`) stores everything in Supabase Postgres. These steps take about 10 minutes and only need doing once.

## 1. Create the project

1. Create a free project at <https://supabase.com/dashboard>. Choose the **Mumbai (ap-south-1)** region so the counter screen stays fast.
2. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.
3. In the repository root, copy `.env.example` to `.env.local` and paste both values:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

   Do not put the service-role key in any `NEXT_PUBLIC_*` variable. The app does not need it.

## 2. Create the tables

Open **SQL Editor → New query** and run every file in [`migrations/`](migrations) **in filename order** (billing, dashboard, customers & substitutes, operators). If you use the Supabase CLI instead, run `supabase db push`.

Using PostgreSQL on this computer instead of Supabase? Put `DATABASE_URL` in `.env.local` and run `npm run db:setup`. It applies the same migrations (plus `local/00_local_shim.sql`, which stands in for Supabase auth) and loads the demo data. Run it again after pulling new migrations. Owner passwords: `npm run db:password -- email password`.

## 3. Lock down sign-ups and add the owner

1. **Authentication → Providers → Email**: keep Email enabled, and turn **off** "Allow new users to sign up".
2. **Authentication → Users → Add user**: create the owner's email and password, and tick "Auto confirm".
3. **Authentication → URL Configuration**: set the Site URL to `https://shreerammedical.com`, and add `http://localhost:3000/admin/login` and `https://shreerammedical.com/admin/login` to the redirect URLs, so "Forgot password" emails work.
4. Give that user owner access. In the SQL Editor, run:

   ```sql
   insert into public.owners (user_id)
   select id from auth.users where email = 'owner@example.com';
   ```

   A signed-in user who is not in `public.owners` can see and change nothing.

## 4. First-day checklist in the app

1. **Settings**: enter the GSTIN and drug licence numbers, choose the printer (A5 or 80mm thermal), add staff with their PINs, and create **operator** logins for the counter (they can only use New Bill).
2. **Suppliers**: add the distributors the shop buys from, with any amount already owed as the opening balance.
3. **Medicines & Stock**: add stock that is already on the shelf with **Add opening stock**. New stock arrives through **Purchases → Enter purchase bill**.
4. **New Bill (F2)**: start billing.

## How the data is protected

- Row level security is on for every table. Owners (`public.owners`) can read everything; operators (`public.operators`) read only cost-free views (`*_public`) and can call only the billing, return and udhaar functions.
- Bills, returns, purchases, payments and stock changes can only be written through the database functions (`create_sale`, `create_purchase`, …). Each function checks the stock, works out the totals and numbers the document in one transaction. A bill can never be saved without its stock movement, or the other way round.
- Bill numbers run in sequence with no gaps, per financial year (e.g. `26-27/0001`), as GST invoices require.
- Staff PINs are stored as bcrypt hashes and can never be read back.
