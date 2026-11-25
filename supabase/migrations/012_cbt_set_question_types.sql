-- CBT sets: GATE-style question types (MCQ, MSQ, NAT), marks and negative marking.
-- Additive and idempotent. Existing sets keep working as MCQ, 1 mark, no negative marking.
--   MCQ: correct_key            (single letter, as before)
--   MSQ: correct_keys           (jsonb array of letters, all-or-nothing)
--   NAT: nat_min / nat_max      (inclusive range; equal for an exact value)

alter table eduorbit_prep.cbt_questions
  add column if not exists type text not null default 'MCQ'
  check (type in ('MCQ', 'MSQ', 'NAT'));
alter table eduorbit_prep.cbt_questions
  add column if not exists marks numeric(5,2) not null default 1
  check (marks > 0 and marks <= 100);
alter table eduorbit_prep.cbt_questions
  add column if not exists negative_marks numeric(6,4) not null default 0
  check (negative_marks >= 0 and negative_marks <= 100);
alter table eduorbit_prep.cbt_questions
  add column if not exists correct_keys jsonb;
alter table eduorbit_prep.cbt_questions
  add column if not exists nat_min numeric;
alter table eduorbit_prep.cbt_questions
  add column if not exists nat_max numeric;

alter table eduorbit_prep.cbt_attempts
  add column if not exists score numeric(8,2);
alter table eduorbit_prep.cbt_attempts
  add column if not exists max_score numeric(8,2);

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
    insert into cbt_questions (
      set_id, number, position, text, passage, explanation, has_figure, image_paths,
      correct_key, type, marks, negative_marks, correct_keys, nat_min, nat_max
    )
    values (
      new_set_id,
      (question->>'number')::integer,
      question_position,
      question->>'text',
      nullif(question->>'passage', ''),
      nullif(question->>'explanation', ''),
      coalesce((question->>'has_figure')::boolean, false),
      coalesce(question->'image_paths', '[]'::jsonb),
      nullif(question->>'correct_key', ''),
      coalesce(nullif(question->>'type', ''), 'MCQ'),
      coalesce(nullif(question->>'marks', '')::numeric, 1),
      coalesce(nullif(question->>'negative_marks', '')::numeric, 0),
      case when jsonb_typeof(question->'correct_keys') = 'array' and jsonb_array_length(question->'correct_keys') > 0 then question->'correct_keys' else null end,
      nullif(question->>'nat_min', '')::numeric,
      nullif(question->>'nat_max', '')::numeric
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

revoke all on function eduorbit_prep.create_cbt_set(jsonb, jsonb) from public, anon, authenticated;
grant execute on function eduorbit_prep.create_cbt_set(jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
