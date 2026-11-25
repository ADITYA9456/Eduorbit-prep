# Privacy Policy (DRAFT TEMPLATE, NOT FOR PUBLICATION)

> **Status: draft prepared from what the code actually does. It has not been reviewed by a lawyer.**
> Every `[PLACEHOLDER]` must be filled in by the business owner, and the whole text must be reviewed by a
> qualified Indian privacy/technology lawyer before it is published. Do not invent details to fill the gaps.

Last updated: `[DATE]`

## 1. Who we are
`[LEGAL ENTITY NAME]`, `[REGISTERED ADDRESS]` ("EDUorbit Prep", "we"). Contact for privacy requests and grievances: `[GRIEVANCE OFFICER NAME]`, `[EMAIL]`, `[RESPONSE TIME, e.g. acknowledge within 24 hours, resolve within 15 days]`.

## 2. What personal data we collect and why

| Data | Source | Purpose | Where it is stored |
|---|---|---|---|
| Name, email address, profile picture, Google account ID | Google sign-in | Create your account and sign you in | Supabase Postgres (`prep_users`) |
| Chosen exam branches, exam date countdown | You | Personalise your dashboard | Supabase Postgres |
| Papers marked complete, per-question progress, private notes | You | Save your preparation across devices | Supabase Postgres |
| Test answers, scores, timings, number of times you left the test tab (exam mode) | You / your browser | Run and grade tests, show your attempt history, deter cheating | Supabase Postgres |
| Technical data: IP address, browser, request logs | Automatic | Security, abuse prevention, debugging | Hosting provider logs `[PROVIDER, RETENTION]` |
| Browser storage (theme, in-progress test state) | Your browser | Remember settings and resume tests | Your device only |

We do not sell personal data. We do not use it for advertising. `[CONFIRM: no analytics/advertising cookies are used. If analytics are added, list them here and add a consent mechanism.]`

## 3. Legal basis and consent
`[LAWYER TO CONFIRM: consent at sign-in, or legitimate uses under the Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025, taking the phased commencement dates into account.]` Consent can be withdrawn by deleting your account (section 6).

## 4. Who we share data with (processors)
- Google (sign-in).
- Supabase (database and file storage) `[REGION]`.
- `[HOSTING PROVIDER, e.g. Vercel]` (hosting and request logs).
- Anthropic (administrators only): question images and answer-key files uploaded by site administrators are sent to an AI model to extract text. Student data is not sent.
`[LAWYER TO CONFIRM: cross-border transfer statement and processor agreements.]`

## 5. How long we keep data
Account and learning data: until you delete your account. Administrator audit logs: `[RETENTION, CERT-In directions expect security logs to be kept for 180 days within India]`. Hosting logs: `[RETENTION]`.

## 6. Your rights
Signed-in users can, from the dashboard ("Your data"): **download** a copy of their data and **delete** their account, which erases their profile, progress, notes and attempts. For correction of data, nomination of another person, or complaints, contact `[GRIEVANCE EMAIL]`. You may also complain to the Data Protection Board of India once it is operational.

## 7. Children
`[DECISION REQUIRED: the service is aimed at exam candidates, many of whom may be under 18. Under the DPDP Act, a child is a person under 18 and processing needs verifiable parental consent and no tracking or targeted advertising. Decide the minimum age, add an age/parental-consent step if under-18 users are allowed, and have it reviewed by a lawyer.]`

## 8. Security
Access to the database is only through our server, sign-in uses Google OAuth, answers to test questions are kept on the server, and administrative actions are logged. No system is perfectly secure. Report problems to `[SECURITY EMAIL]`.

## 9. Breach notification
If a personal data breach affects you we will tell you and the authorities as the law requires `[LAWYER TO CONFIRM TIMELINES]`.

## 10. Changes
We will post changes here and update the date above.
