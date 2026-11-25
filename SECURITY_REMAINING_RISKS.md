# Remaining risks and manual actions

## Do these first

1. **Rotate admin secrets (H-01).** Generate a new password hash and session secret and set them in the hosting environment and `.env.local`:
   - `node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" "new-strong-password"` for `ADMIN_PASSWORD_HASH`
   - `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` for `ADMIN_SESSION_SECRET`
   - Quote the hash in `.env` files if your loader treats `$` specially. Rotating the session secret logs out every admin.
   - Optionally rewrite git history (`git filter-repo`) and force-push; anyone who already cloned keeps the old values, so rotation is the real fix.
2. **Apply `supabase/migrations/013_security_hardening.sql`** in the Supabase SQL editor (additive, reversible; rollback is in the file header). Until then the admin audit log is silently skipped.
3. **Set `ANTHROPIC_API_KEY`** if you use the CBT builder, and set a monthly spend limit in the Anthropic console.
4. **Confirm production env vars** are only in the hosting dashboard, `NEXTAUTH_URL` is the https URL, and `NEXTAUTH_SECRET` is long and random.

## Open technical risks

| Risk | Why it is open | Next step |
|---|---|---|
| CBT-set exam timer is client-side (M-08) | Needs server-side attempt start/deadline | Add `cbt_set_runs(started_at, deadline_at)` and reject late submissions |
| Next.js / PostCSS advisories (L-04) | Fix needs Next 16 (major) | Plan and test an upgrade in a branch |
| In-memory rate limiting (L-05) | Counters are per instance | Use the host's WAF/edge limits or a Redis-backed limiter |
| CSP allows inline scripts | Next.js hydration and theme script | Move to nonce-based CSP |
| Study mode reveals answers one at a time (I-01) | Product design | Do not use for graded contests |
| No malware scanning of uploads | Needs an external service | Admin-only uploads today; add ClamAV or a provider scan before opening uploads to students |
| No automated test suite | None exists | Add integration tests for auth, scoring and RLS |
| Admin cookies cannot be revoked individually (I-04) | Stateless HMAC token | Add a server-side session table if needed |
| RLS and bucket policies not tested with a real anon key | None available here | Run the RLS checks below in a staging project |

## RLS verification to run in staging

With the project's `anon` key, `select` from every `eduorbit_prep` table through PostgREST must fail or return nothing. With an authenticated user JWT, the same must hold (all access is intended to go through the server). Also confirm `eduorbit_prep` exposure in Supabase API settings is only what you need, and that both storage buckets are private.

## Infrastructure items (not code)

HTTPS and HSTS at the host, DNS, database network restrictions, backups and restore test, log retention (CERT-In: 180 days), clock sync, uptime and error monitoring, GitHub secret scanning and Dependabot alerts enabled in repository settings.
