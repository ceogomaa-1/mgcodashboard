-- AI Agent Playground schema + RLS
create extension if not exists pgcrypto;

alter table if exists public.clients
  add column if not exists name text;

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text not null,
  prompt text not null,
  model text not null,
  voice text not null,
  twilio_phone_number text not null,
  twilio_phone_number_sid text,
  status text not null default 'draft' check (status in ('draft','published','paused')),
  client_id uuid references public.clients(id) on delete set null,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_templates (
  id uuid primary key default gen_random_uuid(),
  industry text not null unique,
  template_prompt text not null,
  default_model text not null,
  default_voice text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  google_email text,
  refresh_token text not null,
  access_token text,
  token_expiry timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  twilio_call_sid text not null unique,
  from_number text,
  to_number text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  outcome text check (outcome in ('booked','cancelled','rescheduled','info_only','hangup','transfer','error','other')),
  transcript text,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('audio_started','user_said','agent_said','tool_called','tool_result','booking_created','booking_cancelled','booking_rescheduled','call_ended','error')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agents_client_id_idx on public.agents(client_id);
create index if not exists agents_status_idx on public.agents(status);
create index if not exists agents_phone_idx on public.agents(twilio_phone_number);

create index if not exists calls_agent_id_idx on public.calls(agent_id);
create index if not exists calls_client_id_idx on public.calls(client_id);
create index if not exists calls_started_at_idx on public.calls(started_at desc);

create index if not exists call_events_call_id_idx on public.call_events(call_id);
create index if not exists call_events_client_id_idx on public.call_events(client_id);
create index if not exists call_events_created_at_idx on public.call_events(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agents_set_updated_at on public.agents;
create trigger agents_set_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

drop trigger if exists google_calendar_connections_set_updated_at on public.google_calendar_connections;
create trigger google_calendar_connections_set_updated_at
before update on public.google_calendar_connections
for each row execute function public.set_updated_at();

insert into public.agent_templates (industry, template_prompt, default_model, default_voice)
values
  (
    'Retail',
    'You are the AI receptionist for {{business_name}}.\n- Services: {{services}}\n- Hours: {{hours}}\n- Location: {{location}}\n- Booking rules: {{booking_rules}}\n- Escalation handoff number: {{handoff_number}}\n\nGoals:\n1) Greet warmly and identify caller intent.\n2) Answer product, pricing, return, and store policy questions clearly.\n3) Offer booking support when needed, then confirm date/time and contact details.\n4) If caller requests a human or issue is sensitive, hand off to {{handoff_number}}.\n\nAlways summarize next steps before ending the call.',
    'gpt-4o-realtime-preview-2025-06-03',
    'alloy'
  ),
  (
    'Restaurant',
    'You are the AI host/receptionist for {{business_name}}.\n- Services: {{services}}\n- Hours: {{hours}}\n- Location: {{location}}\n- Booking rules: {{booking_rules}}\n- Escalation handoff number: {{handoff_number}}\n\nGoals:\n1) Handle reservations, cancellations, and reschedules.\n2) Answer menu/allergy/basic policy questions accurately.\n3) Repeat booking details (party size/date/time/name/phone).\n4) If uncertain, escalate to {{handoff_number}}.\n\nKeep responses short, natural, and hospitality-focused.',
    'gpt-4o-realtime-preview-2025-06-03',
    'verse'
  ),
  (
    'Auto Shop',
    'You are the service desk receptionist for {{business_name}}.\n- Services: {{services}}\n- Hours: {{hours}}\n- Location: {{location}}\n- Booking rules: {{booking_rules}}\n- Escalation handoff number: {{handoff_number}}\n\nGoals:\n1) Capture issue details (vehicle make/model/year and symptoms).\n2) Offer available appointment slots and confirm booking details.\n3) Handle cancellations/reschedules politely and clearly.\n4) Escalate urgent safety concerns to {{handoff_number}} immediately.\n\nAlways end with a concise recap of next actions.',
    'gpt-4o-realtime-preview-2025-06-03',
    'alloy'
  ),
  (
    'Clinic',
    'You are the front desk AI receptionist for {{business_name}}.\n- Services: {{services}}\n- Hours: {{hours}}\n- Location: {{location}}\n- Booking rules: {{booking_rules}}\n- Escalation handoff number: {{handoff_number}}\n\nGoals:\n1) Support appointment booking/cancel/reschedule with clear confirmations.\n2) Provide non-diagnostic administrative information only.\n3) For emergencies, tell callers to contact local emergency services immediately.\n4) Route sensitive requests to {{handoff_number}}.\n\nUse calm, professional language and protect privacy.',
    'gpt-4o-realtime-preview-2025-06-03',
    'sage'
  ),
  (
    'Real Estate',
    'You are the AI receptionist for {{business_name}}.\n- Services: {{services}}\n- Hours: {{hours}}\n- Location: {{location}}\n- Booking rules: {{booking_rules}}\n- Escalation handoff number: {{handoff_number}}\n\nGoals:\n1) Qualify buyer/seller/renter inquiries.\n2) Schedule tours/consultations and confirm contact details.\n3) Answer high-level listing and office questions.\n4) Escalate complex negotiations to {{handoff_number}}.\n\nKeep conversations concise and conversion-oriented.',
    'gpt-4o-realtime-preview-2025-06-03',
    'verse'
  )
on conflict (industry) do update set
  template_prompt = excluded.template_prompt,
  default_model = excluded.default_model,
  default_voice = excluded.default_voice;

create or replace function public.current_client_id()
returns uuid
language sql
stable
as $$
  select c.id
  from public.clients c
  where lower(coalesce(c.owner_email, '')) = lower(coalesce(auth.email(), ''))
  limit 1;
$$;

create or replace function public.is_techops()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() ->> 'role') = 'techops'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'techops'
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'techops',
    false
  );
$$;

alter table public.agents enable row level security;
alter table public.agent_templates enable row level security;
alter table public.google_calendar_connections enable row level security;
alter table public.calls enable row level security;
alter table public.call_events enable row level security;

drop policy if exists techops_full_access_agents on public.agents;
create policy techops_full_access_agents on public.agents
for all using (public.is_techops()) with check (public.is_techops());

drop policy if exists client_read_published_agents on public.agents;
create policy client_read_published_agents on public.agents
for select using (
  status = 'published'
  and client_id = public.current_client_id()
);

drop policy if exists techops_full_access_templates on public.agent_templates;
create policy techops_full_access_templates on public.agent_templates
for all using (public.is_techops()) with check (public.is_techops());

drop policy if exists techops_full_access_google_calendar_connections on public.google_calendar_connections;
create policy techops_full_access_google_calendar_connections on public.google_calendar_connections
for all using (public.is_techops()) with check (public.is_techops());

drop policy if exists techops_full_access_calls on public.calls;
create policy techops_full_access_calls on public.calls
for all using (public.is_techops()) with check (public.is_techops());

drop policy if exists client_read_own_calls on public.calls;
create policy client_read_own_calls on public.calls
for select using (client_id = public.current_client_id());

drop policy if exists techops_full_access_call_events on public.call_events;
create policy techops_full_access_call_events on public.call_events
for all using (public.is_techops()) with check (public.is_techops());

drop policy if exists client_read_own_call_events on public.call_events;
create policy client_read_own_call_events on public.call_events
for select using (client_id = public.current_client_id());

do $$
begin
  begin
    alter publication supabase_realtime add table public.calls;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.call_events;
  exception when duplicate_object then null;
  end;
end $$;
