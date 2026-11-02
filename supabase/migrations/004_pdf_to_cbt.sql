-- Additive PDF-to-CBT import, publication, and response storage.
create table if not exists eduorbit_prep.prep_cbt_imports (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid references eduorbit_prep.prep_papers(id) on delete set null,
  created_by text not null references eduorbit_prep.prep_users(id) on delete restrict,
  status text not null default 'PROCESSING' check (status in ('PROCESSING', 'REVIEW', 'FAILED', 'PUBLISHED')),
  question_pdf_name text not null,
  answer_key_pdf_name text,
  question_pdf_path text,
  answer_key_pdf_path text,
  metadata jsonb not null default '{}'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  answer_key jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prep_cbt_imports_paper_status_idx
  on eduorbit_prep.prep_cbt_imports(paper_id, status);

create table if not exists eduorbit_prep.prep_cbt_responses (
  user_id text not null references eduorbit_prep.prep_users(id) on delete cascade,
  paper_id uuid not null references eduorbit_prep.prep_papers(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  mode text not null default 'PRACTICE' check (mode in ('PRACTICE', 'EXAM')),
  remaining_seconds integer,
  submitted_at timestamptz,
  score numeric,
  result jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, paper_id, mode)
);

create index if not exists prep_cbt_responses_paper_idx
  on eduorbit_prep.prep_cbt_responses(paper_id);

alter table eduorbit_prep.prep_cbt_imports enable row level security;
alter table eduorbit_prep.prep_cbt_responses enable row level security;
revoke all on eduorbit_prep.prep_cbt_imports from anon, authenticated;
revoke all on eduorbit_prep.prep_cbt_responses from anon, authenticated;
grant all on eduorbit_prep.prep_cbt_imports to service_role;
grant all on eduorbit_prep.prep_cbt_responses to service_role;

insert into storage.buckets (id, name, public)
values ('eduorbit-cbt-source-pdfs', 'eduorbit-cbt-source-pdfs', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
