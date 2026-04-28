create table if not exists profiles (
  id uuid primary key,
  role text not null check (role in ('patient', 'field_worker', 'clinic_admin', 'doctor')),
  preferred_language text not null default 'en',
  created_at timestamptz not null default now()
);

create table if not exists patients (
  id uuid primary key,
  profile_id uuid references profiles(id),
  full_name text,
  age_years integer not null,
  gender text not null check (gender in ('male', 'female')),
  created_at timestamptz not null default now()
);

create table if not exists screening_records (
  id uuid primary key,
  patient_id uuid not null references patients(id),
  payload jsonb not null,
  overall_risk text not null check (overall_risk in ('LOW', 'MODERATE', 'HIGH', 'URGENT')),
  created_at timestamptz not null default now()
);

create table if not exists lab_reports (
  id uuid primary key,
  screening_record_id uuid not null references screening_records(id),
  source text not null check (source in ('manual', 'ocr')),
  extracted_values jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists referral_notes (
  id uuid primary key,
  screening_record_id uuid not null references screening_records(id),
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key,
  actor_profile_id uuid references profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
