-- Stores each user's one or two selected GATE preparation branches.
create table if not exists eduorbit_prep.prep_user_preparation_branches (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references eduorbit_prep.prep_users(id) on delete cascade,
  branch_id uuid not null references eduorbit_prep.prep_branches(id) on delete restrict,
  position smallint not null check (position between 1 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, branch_id),
  unique (user_id, position)
);

create index if not exists prep_user_preparation_branches_user_idx
  on eduorbit_prep.prep_user_preparation_branches(user_id);

alter table eduorbit_prep.prep_user_preparation_branches enable row level security;
revoke all on eduorbit_prep.prep_user_preparation_branches from anon, authenticated;
grant all on eduorbit_prep.prep_user_preparation_branches to service_role;
