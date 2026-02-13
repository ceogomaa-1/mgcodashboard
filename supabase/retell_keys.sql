alter table if exists public.integrations
  add column if not exists retell_api_key text,
  add column if not exists retell_public_api_key text;

