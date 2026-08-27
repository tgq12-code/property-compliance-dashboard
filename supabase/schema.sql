create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  street_address text not null,
  city text,
  state text,
  zip text,
  county text,
  apn text,
  tax_collector_name text,
  tax_payment_url text,
  annual_property_tax numeric(12,2),
  escrowed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  entity_type text,
  state text,
  entity_number text,
  formation_date date,
  secretary_of_state_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  title text not null,
  category text not null,
  amount_due numeric(12,2),
  due_date date not null,
  frequency text,
  official_payment_url text,
  status text not null default 'upcoming',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obligation_owner_check check (
    not (property_id is not null and business_id is not null)
  )
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  obligation_id uuid not null references public.obligations(id) on delete cascade,
  amount_paid numeric(12,2) not null,
  paid_at date not null,
  receipt_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  reminder_days integer[] not null default array[60,30,14,7,2,0],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.businesses enable row level security;
alter table public.obligations enable row level security;
alter table public.payments enable row level security;
alter table public.reminder_preferences enable row level security;

create policy "users_manage_own_profile" on public.profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "users_manage_own_properties" on public.properties
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_manage_own_businesses" on public.businesses
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_manage_own_obligations" on public.obligations
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_manage_own_payments" on public.payments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_manage_own_reminders" on public.reminder_preferences
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
