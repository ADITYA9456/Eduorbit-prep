-- Additive server-authoritative timing fields for Practice tests and attempts.
alter table eduorbit_prep.prep_practice_tests
  add column if not exists duration_seconds integer
  check (duration_seconds is null or duration_seconds between 60 and 86400);

alter table eduorbit_prep.prep_practice_responses
  add column if not exists started_at timestamptz,
  add column if not exists deadline_at timestamptz;

update eduorbit_prep.prep_practice_tests
set duration_seconds = case when test_type = 'SUBJECT' then 3600 else 10800 end
where duration_seconds is null;

notify pgrst, 'reload schema';
