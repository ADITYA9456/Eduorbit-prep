## [eduorbit-prep-supabase-migration] Supabase prep implementation
- Added isolated, idempotent `prep_` SQL schema with RLS and additive rollback posture.
- Added Supabase browser OAuth flow and callback while retaining NextAuth/Mongoose rollback assets.
- Build was blocked by a concurrent Next process locking `.next/trace`; lint and npm test passed.
- Learnings consumed: [(none)]
