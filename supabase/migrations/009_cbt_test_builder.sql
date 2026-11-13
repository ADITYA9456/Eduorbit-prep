-- Additive image-based CBT test builder: sets, questions, options, optional
-- student attempts, and an extraction-call log used to cap AI calls per admin.
-- Existing PYQ, PDF-to-CBT and Practice tables are not modified.
-- Source images reuse the existing private bucket eduorbit-cbt-source-pdfs
-- (prefix cbt-sets/), so no storage changes are needed.

create table if not exists eduorbit_prep.cbt_sets (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references eduorbit_prep.prep_exams(id) on delete restrict,
  branch_id uuid not null references eduorbit_prep.prep_branches(id) on delete restrict,
  subject_id uuid references eduorbit_prep.prep_subjects(id) on delete restrict,
  year integer check (year is null or year between 1900 and 2200),
  title text not null check (char_length(btrim(title)) between 1 and 250),
  source_images jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  created_by text not null references eduorbit_prep.prep_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists eduorbit_prep.cbt_questions (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references eduorbit_prep.cbt_sets(id) on delete cascade,
  number integer not null check (number > 0),
  position integer not null check (position >= 0),
  text text not null check (char_length(btrim(text)) between 1 and 20000),
  passage text check (passage is null or char_length(passage) <= 20000),
  explanation text check (explanation is null or char_length(explanation) <= 20000),
  has_figure boolean not null default false,
  image_paths jsonb not null default '[]'::jsonb,
  correct_key text check (correct_key is null or correct_key ~ '^[A-Z]$'),
  created_at timestamptz not null default now(),
  unique (set_id, number)
);

create table if not exists eduorbit_prep.cbt_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references eduorbit_prep.cbt_questions(id) on delete cascade,
  key text not null check (key ~ '^[A-Z]$'),
  text text not null check (char_length(text) <= 5000),
  position smallint not null check (position >= 0),
  unique (question_id, key)
);

-- Optional: one row per finished attempt by a signed-in student.
create table if not exists eduorbit_prep.cbt_attempts (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references eduorbit_prep.cbt_sets(id) on delete cascade,
  user_id text not null references eduorbit_prep.prep_users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  correct_count integer not null check (correct_count >= 0),
  attempted_count integer not null check (attempted_count >= 0),
  total_count integer not null check (total_count >= 0),
  completed_at timestamptz not null default now()
);

-- One row per vision-model call, so extraction can be capped per admin.
create table if not exists eduorbit_prep.cbt_extraction_runs (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null references eduorbit_prep.prep_users(id) on delete cascade,
  kind text not null check (kind in ('QUESTIONS', 'ANSWER_KEY')),
  created_at timestamptz not null default now()
);

create index if not exists cbt_sets_listing_idx
  on eduorbit_prep.cbt_sets(exam_id, branch_id, is_published, year desc);
create index if not exists cbt_questions_set_idx
  on eduorbit_prep.cbt_questions(set_id, position);
create index if not exists cbt_options_question_idx
  on eduorbit_prep.cbt_options(question_id, position);
create index if not exists cbt_attempts_user_set_idx
  on eduorbit_prep.cbt_attempts(user_id, set_id, completed_at desc);
create index if not exists cbt_extraction_runs_admin_idx
  on eduorbit_prep.cbt_extraction_runs(admin_id, created_at desc);

-- Saves a whole set in one transaction. p_questions is a JSON array of
-- {number, text, passage, explanation, has_figure, image_paths, correct_key,
--  options: [{key, text}]}.
create or replace function eduorbit_prep.create_cbt_set(p_set jsonb, p_questions jsonb)
returns uuid
language plpgsql
security definer
set search_path = eduorbit_prep, public
as $$
declare
  new_set_id uuid;
  new_question_id uuid;
  question jsonb;
  option_row jsonb;
  question_position integer := 0;
  option_position integer;
begin
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'At least one question is required';
  end if;

  insert into cbt_sets (exam_id, branch_id, subject_id, year, title, source_images, is_published, created_by)
  values (
    (p_set->>'exam_id')::uuid,
    (p_set->>'branch_id')::uuid,
    nullif(p_set->>'subject_id', '')::uuid,
    nullif(p_set->>'year', '')::integer,
    p_set->>'title',
    coalesce(p_set->'source_images', '[]'::jsonb),
    coalesce((p_set->>'is_published')::boolean, false),
    p_set->>'created_by'
  )
  returning id into new_set_id;

  for question in select value from jsonb_array_elements(p_questions) loop
    insert into cbt_questions (set_id, number, position, text, passage, explanation, has_figure, image_paths, correct_key)
    values (
      new_set_id,
      (question->>'number')::integer,
      question_position,
      question->>'text',
      nullif(question->>'passage', ''),
      nullif(question->>'explanation', ''),
      coalesce((question->>'has_figure')::boolean, false),
      coalesce(question->'image_paths', '[]'::jsonb),
      nullif(question->>'correct_key', '')
    )
    returning id into new_question_id;

    option_position := 0;
    for option_row in select value from jsonb_array_elements(coalesce(question->'options', '[]'::jsonb)) loop
      insert into cbt_options (question_id, key, text, position)
      values (new_question_id, option_row->>'key', coalesce(option_row->>'text', ''), option_position);
      option_position := option_position + 1;
    end loop;

    question_position := question_position + 1;
  end loop;

  return new_set_id;
end;
$$;

alter table eduorbit_prep.cbt_sets enable row level security;
alter table eduorbit_prep.cbt_questions enable row level security;
alter table eduorbit_prep.cbt_options enable row level security;
alter table eduorbit_prep.cbt_attempts enable row level security;
alter table eduorbit_prep.cbt_extraction_runs enable row level security;
revoke all on eduorbit_prep.cbt_sets from anon, authenticated;
revoke all on eduorbit_prep.cbt_questions from anon, authenticated;
revoke all on eduorbit_prep.cbt_options from anon, authenticated;
revoke all on eduorbit_prep.cbt_attempts from anon, authenticated;
revoke all on eduorbit_prep.cbt_extraction_runs from anon, authenticated;
grant all on eduorbit_prep.cbt_sets to service_role;
grant all on eduorbit_prep.cbt_questions to service_role;
grant all on eduorbit_prep.cbt_options to service_role;
grant all on eduorbit_prep.cbt_attempts to service_role;
grant all on eduorbit_prep.cbt_extraction_runs to service_role;
revoke all on function eduorbit_prep.create_cbt_set(jsonb, jsonb) from public, anon, authenticated;
grant execute on function eduorbit_prep.create_cbt_set(jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
