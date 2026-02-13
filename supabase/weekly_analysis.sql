create extension if not exists pgcrypto;

create table if not exists public.client_weekly_analyses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  report_file_path text not null,
  report_file_name text not null,
  status text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
  analysis_json jsonb not null default '{}'::jsonb,
  extraction_model text,
  extraction_notes text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, week_start, week_end)
);

create index if not exists client_weekly_analyses_client_week_idx
  on public.client_weekly_analyses (client_id, week_end desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_weekly_analyses_set_updated_at on public.client_weekly_analyses;
create trigger client_weekly_analyses_set_updated_at
before update on public.client_weekly_analyses
for each row execute function public.set_updated_at();
