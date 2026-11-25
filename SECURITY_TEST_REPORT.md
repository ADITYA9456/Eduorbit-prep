# Security test report

Environment: Windows, Node 26, production build (`npm run build`, `next start` on a local port) connected to the project's real Supabase database (read/guest operations only; no destructive tests). The test script is not stored in the repo; its cases are listed here.

## Executed and passed

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 2 pre-existing `react-hooks/exhaustive-deps` warnings in `components/CBTWorkspace.js` |
| `npm run build` | Succeeds, middleware compiled |
| `npm audit` | 8 vulnerabilities before, 2 after `npm audit fix` (lockfile only) |
| Live HTTP checks (37 cases, 0 failures, final run after last code change) | see below |
| Unit checks of `lib/uploadSafety.js` and `lib/rateLimit.js` (12 cases) | all passed |
| Secrets scan | Service-role key, NextAuth secret, Google secret, admin hash and admin session secret not present in `.next/static` (client bundle) and not in any tracked file. Admin hash and session secret are present in 5 historical commits (H-01) |

Live HTTP cases (all PASS): CSP, X-Frame-Options, nosniff, HSTS, Referrer-Policy, Permissions-Policy and COOP present on `/`; no `X-Powered-By`; home page renders 200; `/api/*` responses `Cache-Control: no-store`; unauthenticated `GET /api/progress`, `/api/account`, `/api/countdown`, `/api/cbt` return 401; 12 admin endpoints (create content, bulk, CBT-set create/list/get/patch/delete, extract, sources, PDF import, practice, admin login) return 403 without an admin session; cross-origin POST to `/api/countdown` and `/api/cbt-sets/<id>/check` returns 403; same-origin check returns 200; bad set id returns 404; malformed JSON returns 400; more than 500 answers returns 400; nested answer objects return 400; a valid guest submit returns 200; `/check` response contains no database internals; `/cbt/<id>` HTML contains no `correctKey`, `correctKeys` or `natMin`; `/check` returns 429 after the per-IP limit (23 of 140 rapid calls were limited, counted together with the global limit).

## NOT TESTED

| Item | Reason |
|---|---|
| Admin login flow, admin-login rate limit and cookie flags | Needs a Google session for an admin email plus the admin password |
| All admin mutations (content, bulk, PDF import, practice, CBT sets) after hardening, including audit-log writes | Needs an admin session; compiled and linted only |
| Upload rejection at route level (renamed file, oversize) | Needs an admin session; only the helper was unit-tested |
| Mass-assignment allowlist in `POST /api/admin` | Needs an admin session |
| Signed-in user isolation (reading another user's progress/notes/attempts, IDOR on attempt ids) | Needs two Google test accounts. Code review shows every user query is scoped with `.eq("user_id", user.id)` |
| `GET/DELETE /api/account` while signed in | Needs a test account; deletion is destructive |
| Paper CBT and practice answer stripping and "start first" behaviour | Needs a signed-in session and a published paper CBT or practice test |
| Google sign-in with the `email_verified` check | Needs a real OAuth login |
| Row Level Security with a real `anon`/`authenticated` key | No such key in this environment |
| Migration `013_security_hardening.sql` | Not applied; reviewed by reading only |
| CSP behaviour in real browsers (hydration, Google avatars, PDF iframes, service worker) | No browser automation run |
| GitHub workflow and Dependabot | Not executed on GitHub |
| Regression: registration/OTP, payments, code execution | Not applicable (features do not exist) |
| Regression of student flows (dashboard, papers, practice, CBT sets in exam mode) after the changes | Only the guest CBT-set submit and check paths were exercised; the rest was built and linted, not clicked through |

## How to repeat the live checks

Build, start with `npm run start`, then send the requests listed above (curl or a script) from a different origin header for the CSRF cases. Re-run after every change to `middleware.js`, `next.config.js` or `lib/auth.js`.
