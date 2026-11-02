# EDUorbit Prep database migration

The active Prep runtime uses Auth.js/NextAuth v4 for Google OAuth and the
Supabase PostgreSQL service-role client only for database operations. Supabase
Auth and MongoDB are not used by active code.

The canonical isolated migration is
[`supabase/migrations/001_eduorbit_prep_isolated_schema.sql`](supabase/migrations/001_eduorbit_prep_isolated_schema.sql).
It creates only `eduorbit_prep.*` objects, stores the verified Google provider
account ID as `prep_users.id`, and does not reference `auth.users` or modify
EDUorbit Learn tables.

The server checks the Auth.js session before every user-specific read/write
and uses the session-derived provider ID rather than any browser-supplied user
ID. The service-role key is read only in server modules and seed scripts.

Google Cloud Console must be configured with:

`http://localhost:3000/api/auth/callback/google`

and the equivalent HTTPS Prep deployment URL. Required environment variables
are documented in [`.env.example`](.env.example). Admin access requires both
the configured `ADMIN_EMAIL` and a server-only bcrypt `ADMIN_PASSWORD_HASH`;
the email check alone never grants admin access. No remote migration or data
import was executed.

## Admin password setup

Choose a password locally and generate its hash without sharing the password:

```powershell
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" "choose-a-password"
```

Put the resulting hash in `ADMIN_PASSWORD_HASH`, set `ADMIN_EMAIL` to the
authorized Google email, and set a long random `ADMIN_SESSION_SECRET` in local
`.env.local` and in Vercel Project Settings → Environment Variables. Redeploy
after changing Vercel variables. The password is only compared server-side and
the short-lived admin cookie is HttpOnly.

## Apply the migration

The application requires the Prep tables before the first authenticated page
can load. In the Supabase Dashboard for the project configured by
`NEXT_PUBLIC_SUPABASE_URL`:

1. Open **SQL Editor** and create a new query.
2. Paste the complete contents of
   [`supabase/migrations/001_eduorbit_prep_isolated_schema.sql`](supabase/migrations/001_eduorbit_prep_isolated_schema.sql).
3. Run the query.
4. Open **Project Settings → API → Exposed schemas** and add
   `eduorbit_prep`. Do not remove existing exposed schemas.
5. Save the API settings and wait a few seconds for the schema cache to reload.
6. Stop and restart `npm run dev`, then sign in again.

The query is safe to run more than once because it uses
`create schema/table if not exists` and idempotent index statements. The
application uses `.schema("eduorbit_prep")` for every Prep query.
