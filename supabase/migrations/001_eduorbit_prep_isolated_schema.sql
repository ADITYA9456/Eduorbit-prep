-- EDUorbit Prep isolated schema.
-- This migration creates only objects in eduorbit_prep and does not modify
-- public-schema objects, existing policies, functions, triggers, or data.

create schema if not exists eduorbit_prep;

create table if not exists eduorbit_prep.prep_users (
  id text primary key check (char_length(id) between 1 and 255),
  email text not null unique check (position('@' in email) > 1),
  name text,
  image text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists eduorbit_prep.prep_exams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists eduorbit_prep.prep_branches (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references eduorbit_prep.prep_exams(id) on delete restrict,
  name text not null,
  slug text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, slug)
);

create table if not exists eduorbit_prep.prep_papers (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references eduorbit_prep.prep_exams(id) on delete restrict,
  branch_id uuid not null references eduorbit_prep.prep_branches(id) on delete restrict,
  year integer not null check (year between 1900 and 2200),
  shift text not null check (char_length(btrim(shift)) between 1 and 100),
  title text not null check (char_length(btrim(title)) between 1 and 500),
  description text,
  official_paper_url text,
  official_solution_url text,
  external_pdf_url text,
  question_count integer check (question_count is null or question_count > 0),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists eduorbit_prep.prep_user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references eduorbit_prep.prep_users(id) on delete cascade,
  paper_id uuid not null references eduorbit_prep.prep_papers(id) on delete cascade,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, paper_id),
  check (not is_completed or completed_at is not null)
);

create table if not exists eduorbit_prep.prep_user_question_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references eduorbit_prep.prep_users(id) on delete cascade,
  paper_id uuid not null references eduorbit_prep.prep_papers(id) on delete cascade,
  question_number integer not null check (question_number > 0),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, paper_id, question_number),
  check (not is_completed or completed_at is not null)
);

create table if not exists eduorbit_prep.prep_question_notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references eduorbit_prep.prep_users(id) on delete cascade,
  paper_id uuid not null references eduorbit_prep.prep_papers(id) on delete cascade,
  question_number integer not null check (question_number > 0),
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, paper_id, question_number)
);

create index if not exists prep_branches_exam_id_idx
  on eduorbit_prep.prep_branches(exam_id);
create index if not exists prep_papers_exam_branch_year_idx
  on eduorbit_prep.prep_papers(exam_id, branch_id, year desc);
create unique index if not exists prep_papers_identity_uidx
  on eduorbit_prep.prep_papers(exam_id, branch_id, year, shift);
create index if not exists prep_progress_user_idx
  on eduorbit_prep.prep_user_progress(user_id);
create index if not exists prep_question_progress_user_paper_idx
  on eduorbit_prep.prep_user_question_progress(user_id, paper_id);
create index if not exists prep_question_notes_user_paper_idx
  on eduorbit_prep.prep_question_notes(user_id, paper_id);

alter table eduorbit_prep.prep_users enable row level security;
alter table eduorbit_prep.prep_exams enable row level security;
alter table eduorbit_prep.prep_branches enable row level security;
alter table eduorbit_prep.prep_papers enable row level security;
alter table eduorbit_prep.prep_user_progress enable row level security;
alter table eduorbit_prep.prep_user_question_progress enable row level security;
alter table eduorbit_prep.prep_question_notes enable row level security;

-- No browser role receives access. Auth.js authorization is performed by the
-- trusted server using the service-role client and the session user id.
revoke all on schema eduorbit_prep from anon, authenticated;
revoke all on all tables in schema eduorbit_prep from anon, authenticated;
revoke all on all sequences in schema eduorbit_prep from anon, authenticated;

-- Required for the server-role REST client after the schema is exposed.
grant usage on schema eduorbit_prep to service_role;
grant all on all tables in schema eduorbit_prep to service_role;
grant all on all sequences in schema eduorbit_prep to service_role;

-- Refresh PostgREST's schema cache after the Dashboard query completes.
notify pgrst, 'reload schema';
