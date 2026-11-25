# Security incident response

Fill in the contacts before relying on this. Keep a private copy outside the repository for the people who need it.

- Incident lead: `[NAME, PHONE, EMAIL]`
- Backup: `[NAME, PHONE, EMAIL]`
- Hosting, Supabase, Google Cloud and Anthropic account owners: `[NAMES]`
- Lawyer / privacy adviser: `[NAME, CONTACT]`

## 1. Detect
Sources: reports to the security contact (see `SECURITY.md`), hosting and Supabase logs, unusual 429/401/403 spikes, the `prep_admin_audit_log` table, GitHub secret-scanning or Dependabot alerts, user complaints.

## 2. Triage (first hour)
Record the time you learned of it (use IST and UTC). Decide the type: leaked secret, unauthorised admin access, data exposure, defacement, service abuse, vulnerable dependency. Assign severity using SECURITY_AUDIT.md levels. Start a private incident log (who did what, when).

## 3. Contain
- **Leaked secret:** rotate it immediately. Order: Supabase service-role key (Dashboard, Settings, API), `NEXTAUTH_SECRET` (signs out everyone), `ADMIN_SESSION_SECRET` (signs out admins), `ADMIN_PASSWORD_HASH`, Google OAuth client secret, `ANTHROPIC_API_KEY`. Update the host's environment variables and redeploy.
- **Suspected admin compromise:** rotate `ADMIN_SESSION_SECRET` and the admin password, remove unknown emails from `ADMIN_EMAIL(S)`, review `prep_admin_audit_log` for logins and changes, unpublish suspicious sets and papers.
- **Data exposure:** disable the affected route or feature, keep the evidence, do not delete logs.
- **Abuse or cost spike:** tighten rate limits, block the source at the host or WAF, set provider spend limits.

## 4. Investigate
Preserve hosting logs, Supabase logs and the audit table (export before any clean-up). Determine what data was reachable, for whom, and for how long. Check git history and deployments for the change that introduced it.

## 5. Recover
Fix the root cause, deploy, rotate anything that may have been seen, restore data from backup if it was altered, and verify with the checks in SECURITY_TEST_REPORT.md.

## 6. Notify (get legal advice for the exact duties and deadlines)
- **CERT-In:** the 28 April 2022 directions require reporting specified cyber incidents within 6 hours of noticing them (incidents@cert-in.org.in). Confirm applicability with your adviser.
- **Data Protection Board of India and affected users:** the DPDP Act 2023 and Rules require notice of personal data breaches; timelines depend on the commencement of the rules. `[LAWYER TO CONFIRM]`
- Inform processors affected (Supabase, hosting provider) if they must act.
- Be factual with users: what happened, what data, what you did, what they should do (for example sign in again).

## 7. After the incident
Write a short post-mortem within a week: timeline, root cause, what worked, actions with owners and dates. Update SECURITY_AUDIT.md and add a regression test where possible.
