-- Server-authoritative timing for paper CBT exam attempts (mirrors 008 for practice tests).
alter table eduorbit_prep.prep_cbt_responses
  add column if not exists started_at timestamptz,
  add column if not exists deadline_at timestamptz;

notify pgrst, 'reload schema';
