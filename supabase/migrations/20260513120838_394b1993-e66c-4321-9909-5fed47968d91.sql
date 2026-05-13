
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  shop_name text,
  phone text,
  address text,
  gstin text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- settings
create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lang text not null default 'en',
  theme text not null default 'light',
  currency text not null default 'INR',
  low_stock_default int not null default 5,
  gst_default numeric not null default 18,
  invoice_prefix text not null default 'INV',
  payment_terms text default 'Due on receipt',
  whatsapp_alerts boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
create policy "settings_all_own" on public.settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  qty numeric not null default 0,
  unit text not null default 'pcs',
  purchase_price numeric not null default 0,
  selling_price numeric not null default 0,
  gst numeric not null default 0,
  threshold numeric not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "products_all_own" on public.products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.products(user_id);

-- customers
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  total_purchases numeric not null default 0,
  dues numeric not null default 0,
  last_visit timestamptz,
  created_at timestamptz not null default now()
);
alter table public.customers enable row level security;
create policy "customers_all_own" on public.customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.customers(user_id);

-- suppliers
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;
create policy "suppliers_all_own" on public.suppliers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- invoices
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  number text not null,
  customer_name text not null,
  customer_phone text,
  customer_id uuid references public.customers(id) on delete set null,
  date date not null default current_date,
  subtotal numeric not null default 0,
  cgst numeric not null default 0,
  sgst numeric not null default 0,
  total numeric not null default 0,
  payment_mode text not null default 'Cash',
  status text not null default 'Paid',
  notes text,
  created_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
create policy "invoices_all_own" on public.invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.invoices(user_id);

-- invoice_items
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  qty numeric not null default 1,
  rate numeric not null default 0,
  gst numeric not null default 0,
  amount numeric not null default 0
);
alter table public.invoice_items enable row level security;
create policy "invoice_items_select_own" on public.invoice_items for select using (
  exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
);
create policy "invoice_items_insert_own" on public.invoice_items for insert with check (
  exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
);
create policy "invoice_items_update_own" on public.invoice_items for update using (
  exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
);
create policy "invoice_items_delete_own" on public.invoice_items for delete using (
  exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
);

-- expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  amount numeric not null default 0,
  date date not null default current_date,
  notes text,
  receipt_url text,
  created_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
create policy "expenses_all_own" on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- handle_new_user trigger: create profile + settings
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, shop_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'shop_name', 'My Shop')
  )
  on conflict (id) do nothing;

  insert into public.settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- storage bucket for receipts (private)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_select_own"
on storage.objects for select
using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts_insert_own"
on storage.objects for insert
with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts_update_own"
on storage.objects for update
using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts_delete_own"
on storage.objects for delete
using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
