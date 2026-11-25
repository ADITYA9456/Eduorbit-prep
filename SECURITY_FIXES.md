# Security fixes implemented

Everything below is in the working tree and **has not been committed**. Status reflects the testing described in
SECURITY_TEST_REPORT.md.

| ID | Change | Files | Status |
|---|---|---|---|
| H-02 | Answer keys kept on the server; study mode uses `/check`, graded result from `/submit`; paper CBT and practice strip answers and hide questions until the attempt starts | `app/api/cbt-sets/[id]/check`, `.../submit`, `lib/cbtSets.js`, `lib/cbtSetShared.js`, `app/api/cbt/route.js`, `app/api/practice/route.js`, `lib/cbt.js`, `components/cbt/CbtPlayer.js` | Verified (CBT sets); not fully verified (paper/practice) |
| M-01 | CSP and security headers; `Cache-Control: no-store` on `/api` | `next.config.js` | Verified headers; browser rendering not tested |
| M-02 | Rate limiting helper, global API limit, per-route limits, admin-login limiter keyed on admin email | `lib/rateLimit.js`, `middleware.js`, API routes, `app/api/admin/login/route.js` | `/check` verified; login not tested |
| M-03 | Origin / Sec-Fetch-Site check on state-changing API calls | `middleware.js` | Verified |
| M-04 | Generic error responses, server-side logging | `lib/http.js`, `lib/adminHttp.js`, all API routes | Not fully verified |
| M-05 | Allowlist + validation for admin content writes; UUID validation; bulk limits | `app/api/admin/route.js`, `.../bulk/route.js` | Not fully verified |
| M-06 | Magic-byte upload validation, safe file names, size limits | `lib/uploadSafety.js`, admin upload routes | Helper verified; routes not tested |
| M-07 | Require verified Google email; 14-day sessions | `lib/auth.js` | Not tested |
| L-01 | Revoke public execute on SECURITY DEFINER function; safe default privileges | `supabase/migrations/013_security_hardening.sql` | Migration **not applied** |
| L-02 | Admin audit log (code + table) for admin logins, uploads, edits, publishing, deletion | `lib/audit.js`, migration 013, admin routes | Needs migration 013 |
| L-03 | Data export and account deletion | `app/api/account/route.js`, `components/AccountDataControls.js`, dashboard | Not tested signed in |
| L-04 | `npm audit fix`: 8 vulnerabilities to 2 (lockfile only) | `package-lock.json` | Verified with `npm audit` |
| L-06 | CI workflow and Dependabot (minor/patch only) | `.github/workflows/security.yml`, `.github/dependabot.yml` | Not run on GitHub |
| H-01 | `.env.example` values blanked, `ANTHROPIC_API_KEY` documented | `.env.example` | Does not remove history; rotation required |
| Docs | Draft privacy policy, terms and takedown policy with placeholders | `legal/` | Needs lawyer review |

## Behaviour changes to know about

- API calls whose `Origin` header does not match the site host now get 403. Same-site fetches are unaffected. Non-browser clients without `Origin` still work.
- Practice and paper-exam question text is no longer returned before the attempt is started.
- Admin-side `process` failures show a generic message to the browser; the real error is in the server log.
- Error text for database failures in admin routes is now "Could not save. Check the values and try again."

## Not changed on purpose

Authentication provider, database schema (other than the additive migration 013), existing RLS posture, UI design, and major dependency versions.
