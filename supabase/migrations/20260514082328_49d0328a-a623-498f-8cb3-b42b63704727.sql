alter table public.invoices add column if not exists paid_amount numeric not null default 0;
update public.invoices set paid_amount = total where status = 'Paid' and paid_amount = 0;

create table if not exists public.whatsapp_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  phone text,
  twilio_account_sid text,
  twilio_auth_token text,
  twilio_sender text,
  webhook_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_config enable row level security;

drop policy if exists whatsapp_config_all_own on public.whatsapp_config;
create policy whatsapp_config_all_own on public.whatsapp_config
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);