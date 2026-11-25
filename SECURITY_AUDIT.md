# Security Audit: EduOrbit Prep

Scope: this repository only (EduOrbit Prep). Method: source review of every API route, auth code, migrations, config and
dependencies, plus live checks against a production build (`next start`). This is not a penetration test and not a
certification. No secret values appear in this document.

## 1. Architecture discovered

- Next.js 15.5 (App Router, JavaScript), React 19, Tailwind. Hosting target not defined in the repo (no `vercel.json`, no Dockerfile).
- Auth: NextAuth v4, Google provider only, JWT sessions. Separate admin step: a Google account whose email is in `ADMIN_EMAIL(S)` must also enter `ADMIN_PASSWORD_HASH`'s password; this sets an HMAC-signed `eduorbit_admin` cookie (8 h).
- Data: Supabase Postgres, schema `eduorbit_prep`. All tables have RLS enabled and `anon`/`authenticated` privileges revoked, so only the server (service-role key) reads or writes. **Authorisation therefore lives entirely in server code** (`getCurrentUser`, `requireAdmin`, `.eq("user_id", ...)`).
- Storage: Supabase private buckets (`eduorbit-cbt-source-pdfs`, `eduorbit-practice-sources`) with signed URLs.
- Third party: Google OAuth, Supabase, Anthropic API (admin-only extraction of question images and answer keys). No payments, no code execution, no student-facing AI, no webhooks.
- Features: PYQ papers, paper CBT, practice tests, image-based CBT sets (MCQ/MSQ/NAT), notes, progress, countdown, admin panel.
- Before this audit: no middleware, no security headers, no rate limiting except an in-memory admin-login limiter, no CI, no tests (`npm test` = lint).

## 2. Security inventory

| Component | Status |
|---|---|
| Google OAuth, JWT sessions | Present, needs improvement (unverified emails accepted; 30-day default session) |
| Admin password + signed cookie | Present and secure design; secrets exposed in git history (H-01) |
| Server-side authorisation on every route | Present and secure (every route checks user/admin; queries scoped by `user_id`) |
| RLS / DB grants | Present and secure by design (deny-all to anon/authenticated); not tested with an anon key |
| SECURITY DEFINER functions | Present, needs improvement (default PUBLIC execute on `next_practice_counter`) |
| Input validation | Present but needs improvement (inconsistent) |
| Error handling | Present and vulnerable (raw DB errors returned) |
| Security headers / CSP | Missing |
| CSRF protection for custom APIs | Missing (cookies are SameSite=Lax, so partial) |
| Rate limiting | Missing (besides admin login) |
| File upload validation | Present but needs improvement (declared MIME only) |
| Answer-key protection | Present and secure for CBT sets after earlier work; was vulnerable for paper CBT / practice before |
| Audit log of admin actions | Missing |
| Account export / deletion | Missing |
| Dependency hygiene | Present, needs improvement |
| CI security checks | Missing |
| Payments, code execution, webhooks, student AI | Not applicable |
| Malware scanning of uploads | Missing; requires external service |
| Infra (HTTPS, backups, DNS, monitoring) | Requires external configuration |

## 3. Findings

IDs are stable. Status values: FIXED AND VERIFIED, FIXED BUT NOT FULLY VERIFIED, NOT FIXED, REQUIRES MANUAL ACTION.

### HIGH

**H-01 Admin credential material in git history.** The current `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` values appear in 5 commits (older versions of `.env.example`; remote `origin` is GitHub). Reproduce: `git log --all -S "<value>"` finds commits. Impact: the bcrypt hash can be brute-forced offline; the session secret allows forging the admin cookie, which still needs a matching Google session for an admin email, so exploitation needs both. `.env.example` is now blank, but history is unchanged. **REQUIRES MANUAL ACTION**: rotate both (see SECURITY_REMAINING_RISKS.md). Service-role key, NextAuth secret and Google secret were checked and are not in any commit or in the client bundle.

**H-02 Answer keys delivered to the browser (paper CBT, practice, CBT sets).** `GET /api/cbt` returned each question's `answer`; the CBT-set page shipped `correctKey`; the paper page embedded all questions with answers via `paper.cbt`. Fixed earlier in this engagement: CBT sets are graded by `/api/cbt-sets/[id]/check` and `/submit`; paper/practice APIs strip answers; questions are withheld until an exam is started. Verified: the rendered `/cbt/<id>` HTML contains no `correctKey`, `correctKeys` or `natMin`. **FIXED AND VERIFIED** for CBT sets; **FIXED BUT NOT FULLY VERIFIED** for paper CBT and practice (needs a signed-in session).

### MEDIUM

**M-01 No security headers or CSP.** Fixed in `next.config.js`: CSP, HSTS (production), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP. Verified on a production build. CSP keeps `'unsafe-inline'` for scripts (Next.js hydration and the theme bootstrap), so it limits but does not eliminate XSS impact. Rendering of every page under the CSP in a real browser was not tested. **FIXED BUT NOT FULLY VERIFIED**.

**M-02 No rate limiting; admin-login limiter trusted spoofable `X-Forwarded-For`.** Added `lib/rateLimit.js`, a global per-IP API limit in `middleware.js`, per-route limits (answer check, submit, writes, uploads, account export/delete) and an admin-login limiter keyed on the authenticated admin email. Verified: `/check` returned 429 after the limit. In-memory counters are per server instance. **FIXED BUT NOT FULLY VERIFIED** (admin login limiter not exercised; needs an admin session).

**M-03 No Origin check on state-changing API calls.** Middleware now rejects POST/PUT/PATCH/DELETE under `/api` (except NextAuth) whose `Origin` differs from the host or whose `Sec-Fetch-Site` is `cross-site`. Verified: cross-origin POSTs returned 403, same-origin 200. **FIXED AND VERIFIED**.

**M-04 Internal error messages returned to clients.** Raw Supabase/Postgres messages came back from many routes. Replaced with `serverError` / `saveFailed` (log server-side, generic response). Intentional validation messages and Anthropic `ModelError` messages (admin-only) were kept. Verified by grep that no route returns `error.message` except those two admin cases, and on `/check`. **FIXED BUT NOT FULLY VERIFIED**.

**M-05 Mass assignment in `POST /api/admin`.** Arbitrary body keys were written to `prep_exams`/`prep_branches`/`prep_papers`. Now an allowlist with type and length checks. Admin-only, so impact was limited. **FIXED BUT NOT FULLY VERIFIED** (lint/build only; no admin session).

**M-06 Upload validation trusted the declared MIME type.** Added magic-byte checks (`lib/uploadSafety.js`) to PDF import, practice, CBT-set source, extraction and answer-key uploads, safe file names, and size limits. The helper was unit-tested (renamed executables and HTML-as-PNG rejected). Route-level behaviour not tested (admin only). **FIXED BUT NOT FULLY VERIFIED**. No malware scanning: see remaining risks.

**M-07 Sign-in accepted unverified Google emails.** Admin rights are granted by email, so `signIn` now requires `email_verified`. JWT lifetime set to 14 days. **FIXED BUT NOT FULLY VERIFIED** (needs a real Google login).

**M-08 CBT-set exam timer is client-side.** Answers are graded server-side but the time limit is not enforced by the server, so a student can exceed it. Integrity issue for exam mode only. **NOT FIXED**; needs a server-side attempt start (new table or columns).

### LOW

- **L-01** `next_practice_counter` is SECURITY DEFINER with default PUBLIC execute. Practical risk is low because `anon`/`authenticated` have no schema usage. Migration `013_security_hardening.sql` revokes it and sets safe default privileges. **REQUIRES MANUAL ACTION** (run the migration).
- **L-02** No audit trail of admin actions. Added `lib/audit.js` and table `prep_admin_audit_log`; actions are logged best-effort. Logging only works after migration 013. **REQUIRES MANUAL ACTION**.
- **L-03** No way for users to export or delete data. Added `GET/DELETE /api/account` and a "Your data" panel on the dashboard. Not tested with a signed-in user. **FIXED BUT NOT FULLY VERIFIED**.
- **L-04** Dependencies: `npm audit` reported 8 issues (7 moderate, 1 high). `npm audit fix` (lockfile only) reduced it to 2 (Next.js and the PostCSS copy it bundles). The remainder needs Next 16, a major upgrade, so it was not applied. Exploitation of the PostCSS issues needs attacker-controlled CSS at build time. **NOT FIXED**.
- **L-05** Rate-limit counters are not shared between serverless instances. **REQUIRES MANUAL ACTION** (edge/WAF or Redis limiter).
- **L-06** No automated tests besides lint. Added `.github/workflows/security.yml` (lint, audit) and Dependabot. **FIXED BUT NOT FULLY VERIFIED** (workflow not run on GitHub).

### INFORMATIONAL

- **I-01** Study mode intentionally reveals one answer per `/check` call to anyone, including guests (rate limited at 120/min/IP). A determined user can still collect a set's answers. Acceptable for practice content; do not use study mode for graded contests.
- **I-02** `app/layout.js` uses `dangerouslySetInnerHTML` for a static theme script. No user data reaches it. Safe.
- **I-03** The exam-mode iframe embeds admin-supplied PDF or Google Drive URLs. Only `http(s)` is accepted, `frame-src https:` applies.
- **I-04** The admin cookie is signed and expires after 8 hours, but individual tokens cannot be revoked; rotating `ADMIN_SESSION_SECRET` invalidates all of them.
- **I-05** No CORS headers are set, so cross-origin browser reads of the API are blocked by default.

## 4. Not assessed

RLS behaviour with a real `anon`/`authenticated` key (no such key in this environment); production infrastructure; Supabase dashboard settings; Google OAuth console settings; storage bucket policies in the live project; backups; monitoring.
