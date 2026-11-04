-- Additive Practice test catalogue. Existing PYQ and CBT tables are unchanged.
create table if not exists eduorbit_prep.prep_subjects (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references eduorbit_prep.prep_exams(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 150),
  slug text not null,
  created_at timestamptz not null default now(),
  unique (exam_id, slug)
);

create table if not exists eduorbit_prep.prep_branch_subjects (
  branch_id uuid not null references eduorbit_prep.prep_branches(id) on delete cascade,
  subject_id uuid not null references eduorbit_prep.prep_subjects(id) on delete cascade,
  primary key (branch_id, subject_id)
);

create table if not exists eduorbit_prep.prep_practice_counters (
  branch_id uuid not null references eduorbit_prep.prep_branches(id) on delete restrict,
  counter_type text not null check (counter_type in ('SUBJECT', 'FULL_LENGTH')),
  next_number integer not null default 1 check (next_number > 0),
  primary key (branch_id, counter_type)
);

create or replace function eduorbit_prep.next_practice_counter(
  requested_branch_id uuid,
  requested_counter_type text
) returns integer
language plpgsql
security definer
set search_path = eduorbit_prep, public
as $$
declare allocated_number integer;
begin
  if requested_counter_type not in ('SUBJECT', 'FULL_LENGTH') then
    raise exception 'Unsupported Practice counter type';
  end if;
  insert into prep_practice_counters(branch_id, counter_type)
    values (requested_branch_id, requested_counter_type)
    on conflict (branch_id, counter_type) do nothing;
  update prep_practice_counters
    set next_number = next_number + 1
    where branch_id = requested_branch_id and counter_type = requested_counter_type
    returning next_number - 1 into allocated_number;
  return allocated_number;
end;
$$;

create table if not exists eduorbit_prep.prep_practice_tests (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references eduorbit_prep.prep_exams(id) on delete restrict,
  branch_id uuid not null references eduorbit_prep.prep_branches(id) on delete restrict,
  subject_id uuid references eduorbit_prep.prep_subjects(id) on delete restrict,
  test_type text not null check (test_type in ('SUBJECT', 'FULL_LENGTH')),
  test_number integer not null check (test_number > 0),
  title text not null check (char_length(btrim(title)) between 1 and 250),
  source_files jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_by text not null references eduorbit_prep.prep_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((test_type = 'SUBJECT' and subject_id is not null) or (test_type = 'FULL_LENGTH' and subject_id is null))
);

create unique index if not exists prep_practice_tests_counter_uidx
  on eduorbit_prep.prep_practice_tests(branch_id, test_type, test_number);
create index if not exists prep_practice_tests_listing_idx
  on eduorbit_prep.prep_practice_tests(branch_id, status, created_at desc);

create table if not exists eduorbit_prep.prep_practice_responses (
  user_id text not null references eduorbit_prep.prep_users(id) on delete cascade,
  test_id uuid not null references eduorbit_prep.prep_practice_tests(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  remaining_seconds integer,
  submitted_at timestamptz,
  score numeric,
  result jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, test_id)
);

alter table eduorbit_prep.prep_subjects enable row level security;
alter table eduorbit_prep.prep_branch_subjects enable row level security;
alter table eduorbit_prep.prep_practice_counters enable row level security;
alter table eduorbit_prep.prep_practice_tests enable row level security;
alter table eduorbit_prep.prep_practice_responses enable row level security;
revoke all on all tables in schema eduorbit_prep from anon, authenticated;
grant all on all tables in schema eduorbit_prep to service_role;
grant execute on function eduorbit_prep.next_practice_counter(uuid, text) to service_role;

insert into storage.buckets (id, name, public)
values ('eduorbit-practice-sources', 'eduorbit-practice-sources', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
