-- Security hardening. Additive and idempotent: no data is changed or deleted.
--
-- 1. SECURITY DEFINER functions are executable by PUBLIC unless revoked. Only the server (service_role) may
--    call next_practice_counter; anon/authenticated could otherwise reach it through the exposed schema.
-- 2. Future functions in this schema are not executable by anon/authenticated by default.
-- 3. prep_admin_audit_log records privileged actions (CERT-In style log retention is a deployment concern).
--
-- Rollback: grant execute on function eduorbit_prep.next_practice_counter(uuid, text) to public;
--           drop table if exists eduorbit_prep.prep_admin_audit_log;

revoke all on function eduorbit_prep.next_practice_counter(uuid, text) from public, anon, authenticated;
grant execute on function eduorbit_prep.next_practice_counter(uuid, text) to service_role;

alter default privileges in schema eduorbit_prep revoke execute on functions from public, anon, authenticated;
alter default privileges in schema eduorbit_prep revoke all on tables from anon, authenticated;

create table if not exists eduorbit_prep.prep_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id text,
  admin_email text,
  action text not null check (char_length(action) between 1 and 100),
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists prep_admin_audit_log_created_idx on eduorbit_prep.prep_admin_audit_log(created_at desc);
create index if not exists prep_admin_audit_log_admin_idx on eduorbit_prep.prep_admin_audit_log(admin_id, created_at desc);

alter table eduorbit_prep.prep_admin_audit_log enable row level security;
revoke all on eduorbit_prep.prep_admin_audit_log from anon, authenticated;
grant all on eduorbit_prep.prep_admin_audit_log to service_role;

notify pgrst, 'reload schema';
