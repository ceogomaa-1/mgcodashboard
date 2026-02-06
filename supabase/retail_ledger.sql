create table if not exists public.retail_customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.clients(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  notes text,
  status text not null default 'active',
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists retail_customers_business_id_idx on public.retail_customers (business_id);
create index if not exists retail_customers_business_status_idx on public.retail_customers (business_id, status);

create table if not exists public.retail_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.clients(id) on delete cascade,
  customer_id uuid not null references public.retail_customers(id) on delete cascade,
  type text not null,
  occurred_at timestamptz not null,
  reference text,
  method text,
  receipt_prefix text not null default 'MGCO',
  receipt_number int,
  subtotal_cents int,
  discount_type text not null default 'none',
  discount_value numeric,
  tax_enabled boolean not null default true,
  tax_rate_bps int,
  tax_cents int,
  total_cents int not null,
  amount_paid_cents int not null default 0,
  payment_cents int,
  refund_cents int,
  balance_change_cents int not null,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists retail_transactions_business_id_idx on public.retail_transactions (business_id);
create index if not exists retail_transactions_customer_id_idx on public.retail_transactions (customer_id);
create index if not exists retail_transactions_occurred_at_idx on public.retail_transactions (occurred_at);
create index if not exists retail_transactions_type_idx on public.retail_transactions (type);

create table if not exists public.retail_business_settings (
  business_id uuid primary key references public.clients(id) on delete cascade,
  province_code text,
  default_tax_enabled boolean not null default true,
  default_tax_rate_bps int not null default 1300,
  currency_code text not null default 'CAD',
  receipt_prefix text not null default 'MGCO',
  next_receipt_number int not null default 1,
  updated_at timestamptz not null default now()
);
