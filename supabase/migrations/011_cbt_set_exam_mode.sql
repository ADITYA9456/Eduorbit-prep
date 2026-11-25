-- CBT sets: timed exam mode support. Additive and idempotent.
-- duration_minutes: optional per-set time limit (the player falls back to 2 min/question).
-- cbt_attempts: remembers which mode was used, how long it took, and how many times
-- the student left the tab during an exam-mode attempt.

alter table eduorbit_prep.cbt_sets
  add column if not exists duration_minutes integer
  check (duration_minutes is null or duration_minutes between 1 and 600);

alter table eduorbit_prep.cbt_attempts
  add column if not exists mode text not null default 'STUDY'
  check (mode in ('STUDY', 'EXAM'));
alter table eduorbit_prep.cbt_attempts
  add column if not exists duration_seconds integer
  check (duration_seconds is null or duration_seconds between 0 and 86400);
alter table eduorbit_prep.cbt_attempts
  add column if not exists violations integer not null default 0
  check (violations between 0 and 999);

notify pgrst, 'reload schema';
