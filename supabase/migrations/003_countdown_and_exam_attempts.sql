-- User-owned GATE countdown dates and independent timed PYQ attempts.
create table if not exists eduorbit_prep.prep_user_countdowns (
  user_id text primary key references eduorbit_prep.prep_users(id) on delete cascade,
  exam_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists eduorbit_prep.prep_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references eduorbit_prep.prep_users(id) on delete cascade,
  paper_id uuid not null references eduorbit_prep.prep_papers(id) on delete cascade,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'EXPIRED', 'COMPLETED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (expires_at > started_at),
  check (status <> 'COMPLETED' or completed_at is not null)
);

create index if not exists prep_exam_attempts_user_paper_idx
  on eduorbit_prep.prep_exam_attempts(user_id, paper_id, created_at desc);
create unique index if not exists prep_exam_attempts_one_active_idx
  on eduorbit_prep.prep_exam_attempts(user_id, paper_id)
  where status = 'ACTIVE';

alter table eduorbit_prep.prep_user_countdowns enable row level security;
alter table eduorbit_prep.prep_exam_attempts enable row level security;
revoke all on eduorbit_prep.prep_user_countdowns from anon, authenticated;
revoke all on eduorbit_prep.prep_exam_attempts from anon, authenticated;
grant all on eduorbit_prep.prep_user_countdowns to service_role;
grant all on eduorbit_prep.prep_exam_attempts to service_role;
