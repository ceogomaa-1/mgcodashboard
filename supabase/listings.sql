create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'uploaded',
  address text,
  caption text,
  n8n_response jsonb,
  created_at timestamptz not null default now()
);

alter table public.listings add column if not exists address text;
alter table public.listings add column if not exists caption text;
alter table public.listings add column if not exists n8n_response jsonb;

create index if not exists listings_client_id_idx on public.listings (client_id);

create table if not exists public.listing_assets (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  file_path text not null,
  file_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists listing_assets_listing_id_idx on public.listing_assets (listing_id);

create table if not exists public.listing_logs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists listing_logs_listing_id_idx on public.listing_logs (listing_id);
