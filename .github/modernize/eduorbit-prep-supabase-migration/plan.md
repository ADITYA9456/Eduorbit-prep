# Modernization Plan: EDUorbit Prep Supabase Migration

**Project**: EDUorbit Prep (`d:\Web D\eduordbit`)

## Technical Framework

- **Language**: JavaScript
- **Framework**: Next.js 15.1.6 App Router with React 19
- **Build Tool**: npm
- **Database**: MongoDB/Mongoose 8.9.5 (current); Supabase PostgreSQL (target)
- **Authentication**: NextAuth 4.24.11 with Google provider (current);
  Supabase Auth (target)
- **Key Dependencies**: `mongoose`, `next-auth`, `lucide-react`, Tailwind CSS

## Overview

This migration moves the EDUorbit Prep persistence and authentication runtimes
from the current MongoDB/Mongoose and NextAuth implementation to Supabase
PostgreSQL and Supabase Auth while preserving the existing UI, routes, user
flows, and feature behavior. The migration will:

- preserve the existing exams, branches, papers, progress, notes, and user
  functionality;
- introduce isolated `prep_` PostgreSQL tables with idempotent migrations,
  foreign keys, indexes, and row-level security;
- replace runtime authentication/session integration with Supabase Auth and
  enforce admin authorization without exposing secrets; and
- retain MongoDB variables and seed scripts until verification is complete,
  with no changes to `.env.local` or any external/shared Supabase project.

The work is planned as an implementation-only migration. No code changes are
executed as part of this planning phase.

## Migration Impact Summary

| Application | Original Service | New Azure Service | Authentication | Comments |
|---|---|---|---|---|
| EDUorbit Prep | MongoDB/Mongoose | Supabase PostgreSQL | Supabase Auth | Isolated `prep_` tables |
| EDUorbit Prep | NextAuth | Supabase Auth | Supabase Auth | Preserve Google sign-in |

## Scope and Guardrails

- Audit and preserve all current UI routes and feature behavior.
- Use only this workspace; do not modify another repository or project.
- Create idempotent SQL migration files and
  `SUPABASE_MIGRATION_REPORT.md`.
- Implement RLS and server-side admin authorization.
- Update `.env.example` only; do not read, edit, or copy secrets from
  `.env.local`.
- Preserve MongoDB environment variables and scripts until verification.
- Do not perform destructive database operations, write credentials, or make
  external/shared-project changes.
- Record unavailable Supabase credentials, schema information, or migration
  blockers explicitly.
- Validate with lint, production build, and static checks.

## Current-Codebase Audit

The workspace is a Next.js JavaScript application (no `pom.xml`, Gradle,
`.csproj`, or `.sln` was found). Current persistence is centralized through
`lib/db.js` and Mongoose models under `models/`: `User`, `Exam`, `Branch`,
`Paper`, `Note`, `UserProgress`, and `UserQuestionProgress`. Runtime model
access occurs in the exams, dashboard, notes, paper, progress, and admin
routes/pages. `scripts/seed.js` still seeds MongoDB and must remain available
until verification.

Authentication is configured in `lib/auth.js` and
`app/api/auth/[...nextauth]/route.js`; server pages use
`getServerSession`, and `components/LoginButton.js` uses NextAuth client
sign-in. Admin status currently derives from the comma-separated
`ADMIN_EMAILS` environment variable and is checked by the admin page and
admin API.

No `.github/modernize/rulebook/` was present during the audit. Supabase
credentials and a target schema were not available to the planning workflow;
the implementation must therefore document those as blockers rather than
guessing connection details or applying remote changes.

## Verification Strategy

Capture the current route/feature and static baseline before implementation.
After each migration stage, run repository-local static checks, `npm run lint`,
and `npm run build`. Verify that SQL files are syntactically reviewable and
idempotent by inspection or a local disposable PostgreSQL/Supabase-compatible
environment only. Post-migration verification must cover public browsing,
Google sign-in/session behavior, progress and notes isolation, admin
authorization, and all existing admin creation flows without requiring a
shared project.

## Open Questions & Questionnaire

- [ ] Supabase project URL, anon key, and server-side secret are not available
      in this planning workspace; provide them only through a secure runtime
      environment during execution.
- [ ] The authoritative production MongoDB export/schema and data cutover
      window are unavailable; implementation must document the resulting
      data-mapping and cutover assumptions.
- [ ] Google OAuth redirect URLs for the Supabase Auth project are not
      available; preserve the current provider intent and document the
      configuration blocker.

## Deliverables

- Idempotent, non-destructive SQL migration files using only `prep_` tables.
- `SUPABASE_MIGRATION_REPORT.md` with schema mapping, verification evidence,
  blockers, and rollback/retention notes.
- Safe `.env.example` updates with placeholders only.
- Runtime migration preserving routes/UI/features and guarded admin access.
- Lint, build, and static-check evidence.
