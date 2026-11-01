# Supabase Prep Isolation

Use additive `prep_` tables and retain MongoDB/NextAuth assets until runtime parity is verified.

## What Happened
The local project had no Supabase credentials or authoritative export. The prep migration therefore used only local Mongoose schemas, added RLS policies, and documented blockers instead of attempting remote or destructive operations.

## Takeaway
Keep service-role access server-only, use explicit `prep_` prefixes, and preserve the original runtime as a rollback path until endpoint and data-cutover checks pass.

## History
- 2026-11-01 (eduorbit/eduorbit-prep-supabase-migration): initial
