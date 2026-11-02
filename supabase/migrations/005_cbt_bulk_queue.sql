-- Additive queue states and source fingerprints for independent CBT jobs.
alter table eduorbit_prep.prep_cbt_imports
  drop constraint if exists prep_cbt_imports_status_check;

alter table eduorbit_prep.prep_cbt_imports
  add constraint prep_cbt_imports_status_check
  check (status in ('QUEUED', 'PROCESSING', 'REVIEW', 'FAILED', 'NEEDS_PAIRING', 'PUBLISHED'));

alter table eduorbit_prep.prep_cbt_imports
  add column if not exists batch_id uuid,
  add column if not exists question_sha256 text,
  add column if not exists answer_key_sha256 text;

create index if not exists prep_cbt_imports_batch_idx
  on eduorbit_prep.prep_cbt_imports(batch_id, created_at);
create unique index if not exists prep_cbt_imports_question_hash_uidx
  on eduorbit_prep.prep_cbt_imports(question_sha256)
  where question_sha256 is not null;

notify pgrst, 'reload schema';
