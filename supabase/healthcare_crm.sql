create table if not exists public.healthcare_patients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.clients(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  service_done text not null,
  last_visit_date date not null,
  next_visit_date date,
  notes text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists healthcare_patients_business_id_idx
  on public.healthcare_patients (business_id);

create index if not exists healthcare_patients_business_last_visit_idx
  on public.healthcare_patients (business_id, last_visit_date desc);

create index if not exists healthcare_patients_business_name_idx
  on public.healthcare_patients (business_id, full_name);

create index if not exists healthcare_patients_business_phone_idx
  on public.healthcare_patients (business_id, phone);
