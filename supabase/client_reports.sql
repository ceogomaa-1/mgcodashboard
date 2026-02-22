create extension if not exists pgcrypto;

create table if not exists public.client_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by_user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists client_reports_client_created_idx
  on public.client_reports (client_id, created_at desc);
